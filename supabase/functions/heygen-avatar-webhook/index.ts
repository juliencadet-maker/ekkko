import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("HeyGen avatar webhook received:", JSON.stringify(payload));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // HeyGen avatar/replica callback fields
    const eventType = payload.event_type || payload.type;
    const avatarId = payload.data?.avatar_id || payload.avatar_id;
    const status = payload.data?.status || payload.status;
    const errorMsg = payload.data?.error || payload.message;

    if (!avatarId) {
      console.log("No avatar_id in webhook payload, ignoring");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map HeyGen status to our clone_status
    let cloneStatus: string;
    if (status === "completed" || status === "ready" || eventType === "avatar.completed" || eventType === "avatar.ready") {
      cloneStatus = "ready";
    } else if (status === "error" || status === "failed" || eventType === "avatar.failed") {
      cloneStatus = "error";
    } else if (status === "processing" || eventType === "avatar.processing") {
      cloneStatus = "pending";
    } else {
      console.log("Unhandled avatar status:", status, "event:", eventType);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update identity by provider_identity_id
    const { data: identity, error: findError } = await supabase
      .from("identities")
      .select("id, org_id, owner_user_id, display_name")
      .eq("provider_identity_id", avatarId)
      .single();

    if (findError || !identity) {
      console.error("Identity not found for avatar_id:", avatarId);
      return new Response(JSON.stringify({ ok: true, warning: "Identity not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update clone_status and identity status
    const updatePayload: Record<string, unknown> = { clone_status: cloneStatus };
    if (cloneStatus === "ready") {
      updatePayload.status = "ready";
    }
    if (cloneStatus === "error") {
      updatePayload.metadata = { avatar_error: errorMsg || "Avatar creation failed" };
    }

    await supabase
      .from("identities")
      .update(updatePayload)
      .eq("id", identity.id);

    console.log(`Identity ${identity.id} clone_status updated to: ${cloneStatus}`);

    // Notify identity owner
    if (identity.owner_user_id) {
      const title = cloneStatus === "ready"
        ? "Avatar prêt ✅"
        : "Erreur avatar ❌";
      const message = cloneStatus === "ready"
        ? `L'avatar "${identity.display_name}" est prêt. Vous pouvez maintenant créer des campagnes.`
        : `La création de l'avatar "${identity.display_name}" a échoué. Veuillez réessayer.`;

      await supabase.from("notifications").insert({
        org_id: identity.org_id,
        user_id: identity.owner_user_id,
        title,
        message,
        type: cloneStatus === "ready" ? "avatar_ready" : "avatar_error",
        entity_type: "identity",
        entity_id: identity.id,
      });
    }

    return new Response(JSON.stringify({ ok: true, clone_status: cloneStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("heygen-avatar-webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
