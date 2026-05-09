// Phase 4-fix — Execute an approved pending action with REAL side-effects.
// Internal-only: must be called with SERVICE_ROLE bearer.
// Each handler implements the actual side-effect; on failure the action is
// marked "rejected" (NOT executed) and a system_failure is logged.
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

    const summary: Record<string, unknown> = { action_type: action.action_type };
    let failedHandler = false;
    let errMsg: string | null = null;

    try {
      switch (action.action_type) {
        case "publish_deal_room": {
          const { error } = await supabase.functions.invoke("deal-room-publish", {
            body: { campaign_id: action.campaign_id, ...(action.payload ?? {}) },
          });
          if (error) throw new Error(error.message);
          summary.invoked = "deal-room-publish";
          await writeTimelineEvent(supabase, "agent-converse", {
            campaign_id: action.campaign_id, org_id: action.org_id,
            event_type: "deal_room_published", event_layer: "declared",
            actor_user_id: action.decided_by_user_id ?? action.user_id,
            event_data: { pending_action_id: action.id, payload: action.payload },
          });
          break;
        }

        case "change_voice_source": {
          const newSource = action.payload?.new_voice_source as string | undefined;
          if (!newSource) throw new Error("new_voice_source required");
          const { data: drv, error: drvErr } = await supabase
            .from("deal_room_version")
            .select("id, deal_room_id")
            .eq("campaign_id", action.campaign_id)
            .eq("is_active", true)
            .maybeSingle();
          if (drvErr || !drv) throw new Error("no active deal_room_version");
          const { error: updErr } = await supabase
            .from("deal_room_version")
            .update({ hero_audio_voice_source: newSource })
            .eq("id", drv.id);
          if (updErr) throw new Error(updErr.message);
          await writeTimelineEvent(supabase, "agent-converse", {
            campaign_id: action.campaign_id, org_id: action.org_id,
            event_type: "voice_source_changed", event_layer: "declared",
            actor_user_id: action.decided_by_user_id ?? action.user_id,
            event_data: {
              from: action.payload?.current_voice_source ?? null,
              to: newSource,
              deal_room_version_id: drv.id,
              pending_action_id: action.id,
            },
          });
          summary.changed = "hero_audio_voice_source";
          summary.deal_room_version_id = drv.id;
          break;
        }

        case "send_external_message": {
          const { recipient, subject, body: htmlBody, from } = action.payload ?? {};
          if (!recipient || !subject || !htmlBody) throw new Error("recipient/subject/body required");
          const resendKey = Deno.env.get("RESEND_API_KEY");
          if (!resendKey) throw new Error("RESEND_API_KEY not configured");
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: from || "Ekko <noreply@getekko.eu>",
              to: [recipient],
              subject,
              html: htmlBody,
            }),
          });
          if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
          const result = await r.json();
          await writeTimelineEvent(supabase, "agent-converse", {
            campaign_id: action.campaign_id, org_id: action.org_id,
            event_type: "external_message_sent", event_layer: "declared",
            actor_user_id: action.decided_by_user_id ?? action.user_id,
            event_data: { recipient, subject, resend_id: result.id, pending_action_id: action.id },
          });
          summary.sent_to = recipient;
          summary.resend_id = result.id;
          break;
        }

        case "send_exec_email": {
          const { exec_email, exec_name, subject, body: htmlBody, from } = action.payload ?? {};
          if (!exec_email || !subject || !htmlBody) throw new Error("exec_email/subject/body required");
          const resendKey = Deno.env.get("RESEND_API_KEY");
          if (!resendKey) throw new Error("RESEND_API_KEY not configured");
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: from || "Ekko Executive <exec@getekko.eu>",
              to: [exec_email],
              subject,
              html: htmlBody,
            }),
          });
          if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
          const result = await r.json();
          await writeTimelineEvent(supabase, "agent-converse", {
            campaign_id: action.campaign_id, org_id: action.org_id,
            event_type: "exec_email_sent", event_layer: "declared",
            actor_user_id: action.decided_by_user_id ?? action.user_id,
            event_data: { recipient: exec_email, exec_name: exec_name ?? null, subject, resend_id: result.id, pending_action_id: action.id },
          });
          summary.sent_to = exec_email;
          summary.resend_id = result.id;
          break;
        }

        case "change_gate_mode": {
          const { deal_room_id, new_gate_mode } = action.payload ?? {};
          if (!deal_room_id || !new_gate_mode) throw new Error("deal_room_id/new_gate_mode required");
          const { data: dr, error: drErr } = await supabase
            .from("deal_rooms")
            .select("id, campaign_id, gate_mode")
            .eq("id", deal_room_id)
            .maybeSingle();
          if (drErr || !dr) throw new Error("deal_room not found");
          if (dr.campaign_id !== action.campaign_id) throw new Error("deal_room/campaign mismatch");
          const { error: updErr } = await supabase
            .from("deal_rooms")
            .update({ gate_mode: new_gate_mode })
            .eq("id", deal_room_id);
          if (updErr) throw new Error(updErr.message);
          await writeTimelineEvent(supabase, "agent-converse", {
            campaign_id: action.campaign_id, org_id: action.org_id,
            event_type: "gate_mode_changed", event_layer: "declared",
            actor_user_id: action.decided_by_user_id ?? action.user_id, deal_room_id,
            event_data: { from: dr.gate_mode, to: new_gate_mode, pending_action_id: action.id },
          });
          summary.changed = "gate_mode";
          break;
        }

        case "clone_deal_room": {
          const { source_deal_room_id, target_scope, new_title } = action.payload ?? {};
          if (!source_deal_room_id || !target_scope) throw new Error("source_deal_room_id/target_scope required");
          const { data: src, error: srcErr } = await supabase
            .from("deal_rooms")
            .select("id, campaign_id, title")
            .eq("id", source_deal_room_id)
            .maybeSingle();
          if (srcErr || !src) throw new Error("source deal_room not found");
          if (src.campaign_id !== action.campaign_id) throw new Error("source/campaign mismatch");

          const { data: newDr, error: drErr } = await supabase
            .from("deal_rooms")
            .insert({
              campaign_id: action.campaign_id,
              scope: target_scope,
              is_primary: false,
              title: new_title ?? `${src.title ?? "Deal Room"} (clone)`,
              cloned_from_deal_room_id: source_deal_room_id,
              gate_mode: "public_no_gate",
            })
            .select("id").maybeSingle();
          if (drErr || !newDr) throw new Error(drErr?.message ?? "clone failed");

          const { data: srcVersion } = await supabase
            .from("deal_room_version")
            .select("*")
            .eq("deal_room_id", source_deal_room_id)
            .eq("is_active", true)
            .maybeSingle();
          if (srcVersion) {
            const { id: _id, created_at: _c, updated_at: _u, ...copy } = srcVersion as any;
            await supabase.from("deal_room_version").insert({
              ...copy,
              deal_room_id: newDr.id,
              version_number: 1,
              is_active: false,
            });
          }
          await writeTimelineEvent(supabase, "agent-converse", {
            campaign_id: action.campaign_id, org_id: action.org_id,
            event_type: "deal_room_cloned", event_layer: "declared",
            actor_user_id: action.decided_by_user_id ?? action.user_id, deal_room_id: newDr.id,
            event_data: { source_deal_room_id, target_scope, new_deal_room_id: newDr.id, pending_action_id: action.id },
          });
          summary.new_deal_room_id = newDr.id;
          break;
        }

        case "archive_deal_room": {
          const { deal_room_id, archive_reason } = action.payload ?? {};
          if (!deal_room_id) throw new Error("deal_room_id required");
          const { data: dr, error: drErr } = await supabase
            .from("deal_rooms")
            .select("id, campaign_id")
            .eq("id", deal_room_id)
            .maybeSingle();
          if (drErr || !dr) throw new Error("deal_room not found");
          if (dr.campaign_id !== action.campaign_id) throw new Error("deal_room/campaign mismatch");
          const { error: updErr } = await supabase
            .from("deal_rooms")
            .update({
              archived_at: new Date().toISOString(),
              archived_reason: archive_reason ?? null,
            })
            .eq("id", deal_room_id);
          if (updErr) throw new Error(updErr.message);
          await writeTimelineEvent(supabase, "agent-converse", {
            campaign_id: action.campaign_id, org_id: action.org_id,
            event_type: "deal_room_archived", event_layer: "declared",
            actor_user_id: action.decided_by_user_id ?? action.user_id, deal_room_id,
            event_data: { archive_reason: archive_reason ?? null, pending_action_id: action.id },
          });
          summary.archived = deal_room_id;
          break;
        }

        default:
          throw new Error(`unknown action_type: ${action.action_type}`);
      }
    } catch (e) {
      failedHandler = true;
      errMsg = e instanceof Error ? e.message : "exec error";
      summary.error = errMsg;
      await supabase.from("system_failures").insert({
        failure_type: "execution",
        severity: "medium",
        message: `pending-action-execute: ${action.action_type} failed`,
        campaign_id: action.campaign_id,
        reason: JSON.stringify({ pending_action_id, error: errMsg, timestamp_iso: new Date().toISOString() }),
      });
    }

    // Final state — executed on success, rejected on handler failure (NOT executed).
    const finalStatus = failedHandler ? "rejected" : "executed";
    await supabase.from("pending_external_actions")
      .update({
        status: finalStatus,
        payload: failedHandler
          ? { ...(action.payload ?? {}), _error: errMsg, _failed_at: new Date().toISOString() }
          : action.payload,
      })
      .eq("id", action.id);

    if (!failedHandler) {
      await writeTimelineEvent(supabase, "agent-converse", {
        campaign_id: action.campaign_id, org_id: action.org_id,
        event_type: "action_confirmed", event_layer: "declared",
        actor_user_id: action.decided_by_user_id ?? action.user_id,
        event_data: { pending_action_id: action.id, executed: true, ...summary },
      });
    }

    return j({ ok: !failedHandler, status: finalStatus, summary });
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
