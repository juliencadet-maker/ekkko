import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { identity_ids, audio_base64, file_name } = await req.json();

    if (!identity_ids || !Array.isArray(identity_ids) || !audio_base64) {
      return new Response(JSON.stringify({ error: "identity_ids (array) and audio_base64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Decode base64 audio
    const binaryStr = atob(audio_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const storagePath = `demo/${file_name || "reference-voice.wav"}`;

    // Upload to storage
    const { error: uploadError } = await admin.storage
      .from("identity_assets")
      .upload(storagePath, bytes, {
        contentType: "audio/wav",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: `Upload failed: ${uploadError.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update all identities
    const results = [];
    for (const id of identity_ids) {
      const { error } = await admin
        .from("identities")
        .update({ reference_video_path: storagePath })
        .eq("id", id);
      results.push({ id, success: !error, error: error?.message });
    }

    return new Response(JSON.stringify({ success: true, storage_path: storagePath, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Upload reference audio error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
