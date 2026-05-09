// Phase 4 — AE decides on a pending external action: approve or reject.
// On approve, calls pending-action-execute via service-role internal call.
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
    const { pending_action_id, decision } = await req.json();
    if (!pending_action_id || !["approve", "reject"].includes(decision)) {
      return j({ error: "pending_action_id and decision (approve|reject) required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return j({ error: "unauthenticated" }, 401);
    const { data: u, error: aErr } = await supabase.auth.getUser(token);
    if (aErr || !u?.user) return j({ error: "invalid token" }, 401);
    const userId = u.user.id;

    const { data: action, error: gErr } = await supabase
      .from("pending_external_actions")
      .select("id, user_id, org_id, campaign_id, action_type, payload, status, expires_at")
      .eq("id", pending_action_id)
      .maybeSingle();
    if (gErr || !action) return j({ error: "action not found" }, 404);
    if (action.user_id !== userId) return j({ error: "forbidden" }, 403);
    if (action.status !== "pending") return j({ error: `action already ${action.status}` }, 409);
    if (new Date(action.expires_at).getTime() < Date.now()) {
      await supabase.from("pending_external_actions")
        .update({ status: "expired" }).eq("id", action.id);
      return j({ error: "action expired" }, 410);
    }

    const newStatus = decision === "approve" ? "approved" : "rejected";
    const { error: uErr } = await supabase
      .from("pending_external_actions")
      .update({
        status: newStatus,
        decided_at: new Date().toISOString(),
        decided_by_user_id: userId,
      })
      .eq("id", action.id);
    if (uErr) return j({ error: uErr.message }, 500);

    await writeTimelineEvent(supabase, "agent-converse", {
      campaign_id: action.campaign_id,
      org_id: action.org_id,
      event_type: decision === "approve" ? "action_confirmed" : "action_snoozed",
      event_layer: "declared",
      actor_user_id: userId,
      event_data: { pending_action_id: action.id, decision, action_type: action.action_type },
    });

    let exec_result: any = null;
    if (decision === "approve") {
      // Internal call to execute (service role)
      const execResp = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/pending-action-execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ pending_action_id: action.id }),
        },
      );
      exec_result = await execResp.json().catch(() => ({}));
    }

    return j({ ok: true, status: newStatus, exec_result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return j({ error: msg }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
