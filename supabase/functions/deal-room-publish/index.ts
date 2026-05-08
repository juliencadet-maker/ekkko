// Phase 1c-2 — Publication d'un deal_room_version :
//   1. Set is_active=true sur la version cible (et false sur toutes les autres du même deal_room)
//   2. Synchronise les caches D61 sur deal_rooms (audio_status, video_status)
//   3. INSERT timeline_events 'deal_room_published'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const { deal_room_version_id, actor_user_id } = await req.json();
    if (!deal_room_version_id) return json({ error: "deal_room_version_id required" }, 400);

    const { data: ver, error: vErr } = await supabase
      .from("deal_room_version")
      .select("id, deal_room_id, campaign_id, org_id, audio_status, video_status, audio_storage_path, video_storage_path")
      .eq("id", deal_room_version_id)
      .single();
    if (vErr || !ver) return json({ error: "version not found" }, 404);

    // Demote previous active versions
    await supabase.from("deal_room_version").update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("deal_room_id", ver.deal_room_id).neq("id", deal_room_version_id);

    // Promote target
    const { error: promoteErr } = await supabase.from("deal_room_version").update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", deal_room_version_id);
    if (promoteErr) throw promoteErr;

    // Sync deal_rooms cache (D61)
    const { error: cacheErr } = await supabase.from("deal_rooms").update({
      audio_status: ver.audio_status,
      video_status: ver.video_status,
    }).eq("id", ver.deal_room_id);
    if (cacheErr) throw cacheErr;

    // Insert timeline_events (best-effort — table may differ across orgs)
    const { error: tlErr } = await supabase.from("timeline_events").insert({
      campaign_id: ver.campaign_id,
      org_id: ver.org_id,
      event_type: "deal_room_published",
      event_layer: "fact",
      created_by_user_id: actor_user_id ?? null,
      payload: { deal_room_id: ver.deal_room_id, deal_room_version_id, audio_status: ver.audio_status, video_status: ver.video_status },
    });
    if (tlErr) console.warn("[deal-room-publish] timeline insert warning:", tlErr.message);

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
