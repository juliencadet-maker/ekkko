// Phase 1d.5h — Publication d'un deal_room_version.
//   1. Set is_active=true sur la version cible (et false sur toutes les autres du même deal_room)
//   2. INSERT timeline_events 'deal_room_published' (via timeline-events-writer)
// Suppression des caches D61 sur deal_rooms (audio_status/video_status) :
//   la source de vérité est désormais deal_room_version WHERE is_active=true.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeTimelineEvent } from "../_shared/timeline-events-writer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const body = await req.json();
    const { deal_room_version_id, deal_room_id, actor_user_id } = body ?? {};
    if (!deal_room_version_id) return json({ error: "deal_room_version_id required" }, 400);

    // Fetch target version
    const { data: ver, error: vErr } = await supabase
      .from("deal_room_version")
      .select("id, deal_room_id, campaign_id, org_id, audio_status, video_status, audio_storage_path, video_storage_path")
      .eq("id", deal_room_version_id)
      .maybeSingle();
    if (vErr || !ver) return json({ error: "version not found" }, 404);

    // Optional sanity: caller specified deal_room_id and it doesn't match → reject
    if (deal_room_id && deal_room_id !== ver.deal_room_id) {
      return json({ error: "deal_room_id mismatch" }, 400);
    }

    // Demote previous active versions in same deal_room
    const { error: demoteErr } = await supabase
      .from("deal_room_version")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("deal_room_id", ver.deal_room_id)
      .neq("id", deal_room_version_id);
    if (demoteErr) throw demoteErr;

    // Promote target
    const { error: promoteErr } = await supabase
      .from("deal_room_version")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", deal_room_version_id);
    if (promoteErr) throw promoteErr;

    // Audit
    await writeTimelineEvent(supabase, "deal-room-publish", {
      campaign_id: ver.campaign_id,
      org_id: ver.org_id ?? null,
      event_type: "deal_room_published",
      event_layer: "fact",
      actor_user_id: actor_user_id ?? null,
      deal_room_id: ver.deal_room_id,
      event_data: {
        deal_room_id: ver.deal_room_id,
        deal_room_version_id,
        audio_status: ver.audio_status,
        video_status: ver.video_status,
      },
    });

    return json({ ok: true, deal_room_version_id, deal_room_id: ver.deal_room_id }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("deal-room-publish error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
