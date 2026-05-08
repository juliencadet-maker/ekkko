// Phase 1c-2 R1 (D57) — Double-écriture vers identities.audio_source_path
// (canonique) ET identities.reference_video_path (legacy 30j). Path identique.
// Idempotence : skip si audio_source_path déjà set sur l'identity.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { identity_ids, audio_base64, file_name } = await req.json();

    if (!identity_ids || !Array.isArray(identity_ids) || !audio_base64) {
      return new Response(
        JSON.stringify({ error: "identity_ids (array) and audio_base64 required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Decode base64 audio
    const binaryStr = atob(audio_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const storagePath = `demo/${file_name || "reference-voice.wav"}`;

    // Upload to storage (single source path)
    const { error: uploadError } = await admin.storage
      .from("identity_assets")
      .upload(storagePath, bytes, { contentType: "audio/wav", upsert: true });

    if (uploadError) {
      console.error("[upload-reference-audio] upload_failed:", uploadError);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Idempotence + double-write per identity
    const results: Array<{
      id: string;
      success: boolean;
      skipped?: boolean;
      error?: string;
    }> = [];

    for (const id of identity_ids) {
      // Idempotence : skip si audio_source_path déjà set
      const { data: existing, error: fetchErr } = await admin
        .from("identities")
        .select("audio_source_path")
        .eq("id", id)
        .maybeSingle();

      if (fetchErr) {
        results.push({ id, success: false, error: fetchErr.message });
        continue;
      }

      if (existing?.audio_source_path) {
        console.log(
          `[upload-reference-audio] idempotent_skip identity=${id} path=${existing.audio_source_path}`,
        );
        results.push({ id, success: true, skipped: true });
        continue;
      }

      // Double-write : audio_source_path (canonique) + reference_video_path (legacy 30j)
      const { error: updateErr } = await admin
        .from("identities")
        .update({
          audio_source_path: storagePath,
          reference_video_path: storagePath,
        })
        .eq("id", id);

      if (updateErr) {
        console.error(
          `[upload-reference-audio] write_failed identity=${id}:`,
          updateErr,
        );
        results.push({ id, success: false, error: updateErr.message });
        continue;
      }

      console.log(
        `[upload-reference-audio] dual_write identity=${id} audio_source_path=${storagePath} reference_video_path=${storagePath} (legacy)`,
      );
      results.push({ id, success: true });
    }

    return new Response(
      JSON.stringify({ success: true, storage_path: storagePath, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[upload-reference-audio] unexpected:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
