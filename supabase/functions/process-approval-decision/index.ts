import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { approval_id, action, edited_script, comment } = await req.json();

    if (!approval_id || !action) {
      return new Response(
        JSON.stringify({ error: "Missing approval_id or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      // Update campaign
      const campaignUpdate: Record<string, unknown> = {
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_user_id: approval.assigned_to_user_id,
      };
      if (edited_script) {
        campaignUpdate.script = edited_script;
      }
      await admin.from("campaigns").update(campaignUpdate).eq("id", campaignId);

      // Audit log - approval
      await admin.from("audit_logs").insert({
        org_id: approval.org_id,
        user_id: approval.assigned_to_user_id,
        event_type: "approval_approved",
        entity_type: "approval_request",
        entity_id: approval.id,
        metadata: {
          channel: "external_link",
          script_modified: !!edited_script,
          comment: comment || null,
        },
      });

      // Audit log - campaign approved
      await admin.from("audit_logs").insert({
        org_id: approval.org_id,
        user_id: approval.assigned_to_user_id,
        event_type: "campaign_approved",
        entity_type: "campaign",
        entity_id: campaignId,
        metadata: { approved_via: "external_link" },
      });

      // Auto-trigger video generation
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      try {
        await fetch(`${supabaseUrl}/functions/v1/tavus-generate-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ campaign_id: campaignId }),
        });
      } catch (genError) {
        console.error("Auto video generation trigger error:", genError);
      }
    } else {
      // Rejected
      await admin.from("campaigns").update({ status: "draft" }).eq("id", campaignId);

      await admin.from("audit_logs").insert({
        org_id: approval.org_id,
        user_id: approval.assigned_to_user_id,
        event_type: "approval_rejected",
        entity_type: "approval_request",
        entity_id: approval.id,
        metadata: {
          channel: "external_link",
          comment: comment || null,
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
    console.error("Process approval error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
