// Phase 1d.5h — Timeline events writer
// Forces `logged_via` and validates event_type against a strict whitelist.
// Server-side only: NEVER let clients write timeline_events directly.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const TIMELINE_EVENT_TYPES = [
  // Deal lifecycle
  "deal_created",
  "deal_stage_changed",
  "deal_closed",
  "deal_reopened",
  // Asset / room
  "deal_room_published",
  "asset_attached",
  "asset_detached",
  "asset_reordered",
  // Prospect activity
  "video_view_started",
  "video_view_progress",
  "video_view_completed",
  "video_reaction",
  "video_question",
  "document_opened",
  "document_scrolled",
  "document_downloaded",
  "link_clicked",
  "calendly_booked",
  // Forwarding
  "forward_magnet_submitted",
  "internal_forward_detected",
  // Agent + AE
  "agent_message",
  "agent_suggestion_emitted",
  "action_confirmed",
  "action_snoozed",
  "ae_offline_signal",
  // Approvals
  "approval_requested",
  "approval_decided",
  // System
  "scoring_recomputed",
  "trigger_fired",
  "voxtral_retry",
] as const;

export type TimelineEventType = typeof TIMELINE_EVENT_TYPES[number];

export type EventLayer = "fact" | "inference" | "declared";

export type LoggedVia =
  | "ekko-agent"
  | "agent-converse"
  | "deal-room-publish"
  | "deal-assets-attach"
  | "deal-assets-detach"
  | "deal-assets-reorder"
  | "ingest-video-event"
  | "track-watch-progress"
  | "track-document-events"
  | "submit-prospect-reaction"
  | "submit-video-reaction"
  | "prospect-feedback"
  | "forward-magnet-submit"
  | "process-approval-decision"
  | "notify-approval"
  | "compute-deal-scores"
  | "deal-trigger-notify"
  | "voxtral-tts"
  | "seed-demo";

export interface TimelineEventInput {
  campaign_id: string;
  org_id?: string | null;
  event_type: TimelineEventType;
  event_layer: EventLayer;
  event_data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  actor_user_id?: string | null;
  created_by_user_id?: string | null;
  viewer_id?: string | null;
  viewer_hash?: string | null;
  deal_room_id?: string | null;
}

export async function writeTimelineEvent(
  supabase: SupabaseClient,
  via: LoggedVia,
  evt: TimelineEventInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!TIMELINE_EVENT_TYPES.includes(evt.event_type)) {
    return { ok: false, error: `unknown event_type: ${evt.event_type}` };
  }
  const row = {
    ...evt,
    logged_via: via,
    actor_user_id: evt.actor_user_id ?? evt.created_by_user_id ?? null,
  };
  const { data, error } = await supabase.from("timeline_events").insert(row).select("id").maybeSingle();
  if (error) {
    console.warn(`[timeline:${via}] insert failed:`, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: (data as any)?.id };
}
