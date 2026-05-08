// Phase 1c-2 — Génère l'audio Voxtral mp3 natif pour un deal_room_version.
// Cap : 20 régénérations / 24h / deal_room_id (Q7) → 429.
// Storage : deal-room-audio (privé) | <org_id>/<campaign_id>/<deal_room_id>/<version_number>.mp3
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSystemFailure } from "../_shared/system-failures.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REGEN_CAP_24H = 20;
const MISTRAL_API_URL = "https://api.mistral.ai/v1/audio/speech";

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

    const { data: ver, error: verErr } = await supabase
      .from("deal_room_version")
      .select("id, deal_room_id, campaign_id, org_id, version_number, script_naturalized, script_raw_text")
      .eq("id", deal_room_version_id)
      .single();
    if (verErr || !ver) return json({ error: "deal_room_version not found" }, 404);

    const text = ver.script_naturalized || ver.script_raw_text;
    if (!text) return json({ error: "no script available for audio generation" }, 400);

    // Cap 24h check (Q7) — count of versions for same deal_room created in last 24h
    const { count } = await supabase
      .from("deal_room_version")
      .select("id", { count: "exact", head: true })
      .eq("deal_room_id", ver.deal_room_id)
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    if ((count ?? 0) > REGEN_CAP_24H) {
      return json({ error: "rate_limit", message: `Limite atteinte ${REGEN_CAP_24H} régénérations/24h. Contactez support si besoin.` }, 429);
    }

    // Voxtral identity lookup via campaign → identity
    const { data: campaign } = await supabase.from("campaigns").select("identity_id").eq("id", ver.campaign_id).single();
    if (!campaign?.identity_id) return json({ error: "campaign has no identity" }, 400);

    const { data: identity } = await supabase.from("identities").select("audio_source_path, reference_video_path, cloning_active").eq("id", campaign.identity_id).single();
    if (!identity) return json({ error: "identity not found" }, 404);
    if (identity.cloning_active === false) return json({ error: "identity_locked", message: "Cette identité a été désactivée. Contactez l'admin." }, 423);

    const voicePath = identity.audio_source_path || identity.reference_video_path;
    if (!voicePath) return json({ error: "no voice reference" }, 400);

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY not set");

    // Get signed URL of voice reference
    const refBucket = voicePath.split("/")[0] === "identity_assets" ? "identity_assets" : "deal-videos";
    const refKey = voicePath.replace(`${refBucket}/`, "");
    const { data: signed } = await supabase.storage.from(refBucket).createSignedUrl(refKey, 600);
    if (!signed?.signedUrl) throw new Error("failed to sign voice reference");

    // Call Voxtral TTS
    const ttsRes = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${MISTRAL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "voxtral-mini-tts-2603",
        voice: { reference_audio_url: signed.signedUrl },
        input: text,
        response_format: "mp3",
      }),
    });

    if (!ttsRes.ok) {
      const errTxt = await ttsRes.text();
      await logSystemFailure({ supabase, failure_type: "voxtral_tts_failed", severity: "high", reason: { error_code: `voxtral_${ttsRes.status}`, provider: "voxtral", attempt_n: 1, request_id: null, deal_room_version_id, external_ref: errTxt.slice(0, 200) }, campaign_id: ver.campaign_id, org_id: ver.org_id });
      throw new Error(`Voxtral ${ttsRes.status}: ${errTxt.slice(0, 200)}`);
    }

    const audioBytes = new Uint8Array(await ttsRes.arrayBuffer());

    // Upload to deal-room-audio
    const path = `${ver.org_id}/${ver.campaign_id}/${ver.deal_room_id}/v${ver.version_number}.mp3`;
    const { error: upErr } = await supabase.storage.from("deal-room-audio").upload(path, audioBytes, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw upErr;

    // Update deal_room_version
    await supabase.from("deal_room_version").update({
      audio_status: "ready",
      audio_storage_path: `deal-room-audio/${path}`,
      audio_duration_ms: null,
      provider_audio: "voxtral",
      updated_at: new Date().toISOString(),
    }).eq("id", deal_room_version_id);

    return json({ ok: true, audio_storage_path: `deal-room-audio/${path}` }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("generate-deal-room-audio error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
