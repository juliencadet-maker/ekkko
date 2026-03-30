import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ACTIONS = ["approved", "rejected"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { approval_id, action, edited_script, comment } = body;

    // Validate inputs
    if (!approval_id || typeof approval_id !== "string" || !UUID_REGEX.test(approval_id)) {
      return new Response(
        JSON.stringify({ error: "Valid approval_id (UUID) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be 'approved' or 'rejected'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate optional string fields
    const safeScript = typeof edited_script === "string" ? edited_script.slice(0, 50000) : null;
    const safeComment = typeof comment === "string" ? comment.slice(0, 2000) : null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch approval
    const { data: approval, error: fetchError } = await admin
      .from("approval_requests")
      .select("*, campaigns(id, name, identity_id, created_by_user_id)")
      .eq("id", approval_id)
      .single();

    if (fetchError || !approval) {
      return new Response(
        JSON.stringify({ error: "Approval not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const campaignId = approval.campaign_id;

    if (action === "approved") {
      const campaignUpdate: Record<string, unknown> = {
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_user_id: approval.assigned_to_user_id,
      };
      if (safeScript) {
        campaignUpdate.script = safeScript;
      }
      await admin.from("campaigns").update(campaignUpdate).eq("id", campaignId);

      await admin.from("audit_logs").insert({
        org_id: approval.org_id,
        user_id: approval.assigned_to_user_id,
        event_type: "approval_approved",
        entity_type: "approval_request",
        entity_id: approval.id,
        metadata: {
          channel: "external_link",
          script_modified: !!safeScript,
          comment: safeComment,
        },
      });

      await admin.from("audit_logs").insert({
        org_id: approval.org_id,
        user_id: approval.assigned_to_user_id,
        event_type: "campaign_approved",
        entity_type: "campaign",
        entity_id: campaignId,
        metadata: { approved_via: "external_link" },
      });

      // Auto-trigger video generation using service role key
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      try {
        const genRes = await fetch(`${supabaseUrl}/functions/v1/tavus-generate-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")!}`,
            "x-service-role-key": serviceKey,
          },
          body: JSON.stringify({ campaign_id: campaignId }),
        });
        const genData = await genRes.json();
        console.log("Video generation triggered:", genRes.status, JSON.stringify(genData));
      } catch (genError) {
        console.error("Auto video generation trigger failed:", genError);
      }
    } else {
      await admin.from("campaigns").update({ status: "draft" }).eq("id", campaignId);

      await admin.from("audit_logs").insert({
        org_id: approval.org_id,
        user_id: approval.assigned_to_user_id,
        event_type: "approval_rejected",
        entity_type: "approval_request",
        entity_id: approval.id,
        metadata: {
          channel: "external_link",
          comment: safeComment,
        },
      });

      await admin.from("audit_logs").insert({
        org_id: approval.org_id,
        user_id: approval.assigned_to_user_id,
        event_type: "campaign_rejected",
        entity_type: "campaign",
        entity_id: campaignId,
      });
    }

    return new Response(
      JSON.stringify({ success: true, action }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process approval error");
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
