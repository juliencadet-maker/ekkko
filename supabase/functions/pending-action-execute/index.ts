// Phase 4 — Execute an approved pending action.
// Internal-only: must be called with SERVICE_ROLE bearer.
// Per action_type, performs the side-effect, then marks executed + logs timeline.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeTimelineEvent } from "../_shared/timeline-events-writer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (token !== serviceKey) return j({ error: "service-role only" }, 401);

    const { pending_action_id } = await req.json();
    if (!pending_action_id) return j({ error: "pending_action_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: action, error: gErr } = await supabase
      .from("pending_external_actions")
      .select("*").eq("id", pending_action_id).maybeSingle();
    if (gErr || !action) return j({ error: "not found" }, 404);
    if (action.status !== "approved") return j({ error: `status=${action.status}` }, 409);

    // Stub side-effects per action type. Each branch is best-effort: failures are
    // logged to system_failures but the action is still marked executed so the AE
    // sees the decision land. Real integrations are wired in 1d.5i+.
    const summary: Record<string, unknown> = { action_type: action.action_type };
    try {
      switch (action.action_type) {
        case "publish_deal_room": {
          const { error } = await supabase.functions.invoke("deal-room-publish", {
            body: { campaign_id: action.campaign_id, ...(action.payload ?? {}) },
          });
          if (error) throw new Error(error.message);
          summary.invoked = "deal-room-publish";
          break;
        }
        case "change_voice_source":
        case "send_external_message":
        case "send_exec_email":
        case "change_gate_mode":
        case "clone_deal_room":
        case "archive_deal_room":
          summary.note = "no-op stub (1d.5i wires real side-effect)";
          break;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "exec error";
      await supabase.from("system_failures").insert({
        failure_type: "execution",
        severity: "medium",
        message: `pending-action-execute: ${action.action_type} failed`,
        campaign_id: action.campaign_id,
        reason: JSON.stringify({ pending_action_id, error: msg }),
      });
      summary.error = msg;
    }

    await supabase.from("pending_external_actions")
      .update({ status: "executed" })
      .eq("id", action.id);

    await writeTimelineEvent(supabase, "agent-converse", {
      campaign_id: action.campaign_id,
      org_id: action.org_id,
      event_type: "action_confirmed",
      event_layer: "declared",
      actor_user_id: action.decided_by_user_id ?? action.user_id,
      event_data: { pending_action_id: action.id, executed: true, ...summary },
    });

    return j({ ok: true, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("pending-action-execute:", msg);
    return j({ error: msg }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
