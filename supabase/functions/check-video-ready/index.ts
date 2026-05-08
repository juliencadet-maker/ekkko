// Phase 1c-2 — Poll Tavus / HeyGen pour savoir si la vidéo d'un deal_room_version est prête.
// Met à jour deal_room_version.video_status + video_storage_path quand ready.
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
    const { deal_room_version_id } = await req.json();
    if (!deal_room_version_id) return json({ error: "deal_room_version_id required" }, 400);

    const { data: ver, error } = await supabase
      .from("deal_room_version")
      .select("id, video_status, provider_video, provider_job_id, campaign_id, deal_room_id, org_id, version_number")
      .eq("id", deal_room_version_id)
      .single();
    if (error || !ver) return json({ error: "version not found" }, 404);

    if (ver.video_status === "ready") {
      return json({ ok: true, status: "ready", already: true }, 200);
    }
    if (!ver.provider_job_id) {
      return json({ ok: false, status: ver.video_status, reason: "no job id yet" }, 200);
    }

    let pollUrl = "";
    let pollHeaders: Record<string, string> = {};
    if (ver.provider_video === "tavus") {
      pollUrl = `https://tavusapi.com/v2/videos/${ver.provider_job_id}`;
      pollHeaders = { "x-api-key": Deno.env.get("TAVUS_API_KEY")! };
    } else if (ver.provider_video === "heygen") {
      pollUrl = `https://api.heygen.com/v1/video_status.get?video_id=${ver.provider_job_id}`;
      pollHeaders = { "X-Api-Key": Deno.env.get("HEYGEN_API_KEY")! };
    } else {
      return json({ error: `unknown provider: ${ver.provider_video}` }, 400);
    }

    const pollRes = await fetch(pollUrl, { headers: pollHeaders });
    if (!pollRes.ok) {
      return json({ ok: false, status: ver.video_status, provider_status: pollRes.status }, 200);
    }
    const pollData = await pollRes.json();

    // Tavus: pollData.status === 'ready' / pollData.download_url
    // HeyGen: pollData.data.status === 'completed' / pollData.data.video_url
    let isReady = false;
    let videoUrl: string | null = null;
    if (ver.provider_video === "tavus") {
      isReady = pollData.status === "ready" || pollData.status === "completed";
      videoUrl = pollData.download_url || pollData.hosted_url || null;
    } else {
      isReady = pollData?.data?.status === "completed";
      videoUrl = pollData?.data?.video_url || null;
    }

    if (!isReady) {
      return json({ ok: false, status: "processing", provider_raw: pollData?.status ?? pollData?.data?.status }, 200);
    }
    if (!videoUrl) return json({ error: "ready but no video url" }, 502);

    // Download & upload to deal-room-video bucket
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`download failed: ${videoRes.status}`);
    const videoBytes = new Uint8Array(await videoRes.arrayBuffer());
    const path = `${ver.org_id}/${ver.campaign_id}/${ver.deal_room_id}/v${ver.version_number}.mp4`;
    const { error: upErr } = await supabase.storage.from("deal-room-video").upload(path, videoBytes, { contentType: "video/mp4", upsert: true });
    if (upErr) throw upErr;

    await supabase.from("deal_room_version").update({
      video_status: "ready",
      video_storage_path: `deal-room-video/${path}`,
      updated_at: new Date().toISOString(),
    }).eq("id", deal_room_version_id);

    return json({ ok: true, status: "ready", video_storage_path: `deal-room-video/${path}` }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("check-video-ready error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
