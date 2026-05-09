// Phase 4 — Create a pending external action requiring AE approval.
// Called by edge functions (e.g. agent tools) or directly by the agent surface.
// JWT auth required. Inserts pending_external_actions + agent_notification_queue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeTimelineEvent } from "../_shared/timeline-events-writer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ACTION_TYPES = new Set([
  "change_voice_source",
  "publish_deal_room",
  "send_external_message",
  "send_exec_email",
  "change_gate_mode",
  "clone_deal_room",
  "archive_deal_room",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { campaign_id, action_type, payload, deal_room_id } = body ?? {};
    if (!campaign_id || !ACTION_TYPES.has(action_type)) {
      return j({ error: "campaign_id and valid action_type required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let userId: string | null = null;

    if (token === serviceKey) {
      userId = body.user_id ?? null;
    } else if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) return j({ error: "invalid token" }, 401);
      userId = data.user.id;
    }
    if (!userId) return j({ error: "unauthenticated" }, 401);

    // Resolve campaign + org, validate user belongs to org
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns").select("id, org_id, name").eq("id", campaign_id).maybeSingle();
    if (cErr || !campaign) return j({ error: "campaign not found" }, 404);

    const { data: membership } = await supabase
      .from("org_memberships").select("org_id, role")
      .eq("user_id", userId).eq("is_active", true).maybeSingle();
    if (!membership || membership.org_id !== campaign.org_id) {
      return j({ error: "forbidden" }, 403);
    }

    // Insert pending action (UNIQUE partial idx prevents duplicates while pending)
    const { data: action, error: insErr } = await supabase
      .from("pending_external_actions")
      .insert({
        user_id: userId,
        org_id: campaign.org_id,
        campaign_id,
        deal_room_id: deal_room_id ?? null,
        action_type,
        payload: payload ?? {},
        status: "pending",
      })
      .select("id, expires_at")
      .maybeSingle();
    if (insErr) {
      const msg = insErr.message.includes("uniq_pea_live_pending")
        ? "Action déjà en attente pour ce deal."
        : insErr.message;
      return j({ error: msg }, 409);
    }

    // Notification
    await supabase.from("agent_notification_queue").insert({
      user_id: userId,
      org_id: campaign.org_id,
      campaign_id,
      kind: "external_action_pending",
      title: titleFor(action_type),
      body: `Sur le deal "${campaign.name}". Validez ou rejetez avant ${new Date(action!.expires_at).toLocaleString("fr-FR")}.`,
      payload: { pending_action_id: action!.id, action_type },
    });

    await writeTimelineEvent(supabase, "agent-converse", {
      campaign_id,
      org_id: campaign.org_id,
      event_type: "agent_suggestion_emitted",
      event_layer: "declared",
      actor_user_id: userId,
      event_data: { pending_action_id: action!.id, action_type },
    });

    return j({ ok: true, pending_action_id: action!.id, expires_at: action!.expires_at });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("pending-action-create:", msg);
    return j({ error: msg }, 500);
  }
});

function titleFor(t: string) {
  const labels: Record<string, string> = {
    change_voice_source: "Changement de source vocale",
    publish_deal_room: "Publication du deal room",
    send_external_message: "Envoi d'un message externe",
    send_exec_email: "Envoi d'un email exec",
    change_gate_mode: "Changement de mode de gate",
    clone_deal_room: "Clonage du deal room",
    archive_deal_room: "Archivage du deal room",
  };
  return labels[t] ?? "Action en attente de validation";
}

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
