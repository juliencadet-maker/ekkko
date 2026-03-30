import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MISTRAL_API_URL = "https://api.mistral.ai/v1/audio/speech";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "MISTRAL_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { script, identity_id, campaign_id } = await req.json();

    if (!script || !identity_id) {
      return new Response(
        JSON.stringify({ error: "script and identity_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch identity to get voice reference (audio or video source)
    const { data: identity, error: identityError } = await supabase
      .from("identities")
      .select("*")
      .eq("id", identity_id)
      .single();

    if (identityError || !identity) {
      return new Response(
        JSON.stringify({ error: "Identity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prefer dedicated voice reference audio, fall back to reference video
    const metadata = (identity.metadata as Record<string, unknown>) || {};
    const voiceReferencePath = (metadata.voice_reference_path as string) || identity.reference_video_path;

    if (!voiceReferencePath) {
      return new Response(
        JSON.stringify({ error: "Identity has no voice reference for cloning" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get a signed URL for the reference video (used as voice prompt)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from("identity_assets")
      .createSignedUrl(voiceReferencePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Signed URL error:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate reference video URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating Voxtral TTS for identity ${identity_id}, voice ref: ${voiceReferencePath}, script length: ${script.length}`);

    // Download the reference video to use as voice prompt
    const refVideoResponse = await fetch(signedUrlData.signedUrl);
    if (!refVideoResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to download reference video" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const refVideoBytes = await refVideoResponse.arrayBuffer();
    const uint8 = new Uint8Array(refVideoBytes);
    let refVideoBase64 = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      const chunk = uint8.subarray(i, Math.min(i + chunkSize, uint8.length));
      refVideoBase64 += String.fromCharCode(...chunk);
    }
    refVideoBase64 = btoa(refVideoBase64);

    // Determine MIME type from file extension
    const ext = voiceReferencePath.split('.').pop()?.toLowerCase() || 'webm';
    const mimeMap: Record<string, string> = {
      'webm': 'audio/webm', 'mp4': 'video/mp4', 'wav': 'audio/wav',
      'mp3': 'audio/mp3', 'm4a': 'audio/m4a',
    };
    const mimeType = mimeMap[ext] || 'audio/webm';

    // Call Voxtral TTS with voice cloning (zero-shot)
    const voxtralResponse = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "voxtral-mini-tts-2603",
        input: script,
        ref_audio: refVideoBase64,
        response_format: "wav",
      }),
    });

    if (!voxtralResponse.ok) {
      const errorText = await voxtralResponse.text();
      console.error("Voxtral TTS error:", voxtralResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Voxtral TTS error: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON response — Voxtral returns { audio_data: "<base64>" }
    const ttsJson = await voxtralResponse.json();
    const audioBase64Data = ttsJson.audio_data;
    if (!audioBase64Data) {
      console.error("Voxtral TTS: no audio_data in response", Object.keys(ttsJson));
      return new Response(
        JSON.stringify({ error: "Voxtral TTS returned no audio data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 to binary
    const binaryStr = atob(audioBase64Data);
    const audioBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      audioBytes[i] = binaryStr.charCodeAt(i);
    }

    const timestamp = Date.now();
    const audioPath = `generated_audio/${campaign_id || 'manual'}/${identity_id}/${timestamp}.wav`;

    const { error: uploadError } = await serviceClient.storage
      .from("generated_videos")
      .upload(audioPath, audioBytes.buffer, {
        contentType: "audio/wav",
        upsert: true,
      });

    if (uploadError) {
      console.error("Audio upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to store generated audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a signed URL for the generated audio (for Tavus to consume)
    const { data: audioSignedUrl, error: audioUrlError } = await serviceClient.storage
      .from("generated_videos")
      .createSignedUrl(audioPath, 7200); // 2 hours for Tavus processing

    if (audioUrlError || !audioSignedUrl?.signedUrl) {
      console.error("Audio signed URL error:", audioUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate audio URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Voxtral TTS audio generated and stored:", audioPath);

    return new Response(
      JSON.stringify({
        success: true,
        audio_url: audioSignedUrl.signedUrl,
        audio_path: audioPath,
        duration_chars: script.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("voxtral-tts error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
