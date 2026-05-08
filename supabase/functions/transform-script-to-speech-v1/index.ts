// Phase 1c-2 — Fork B' V1.5 du naturaliseur de script.
// V0 byte-identical sur la logique LLM (consomme _shared/script-to-speech.ts).
// CIBLE D'ÉCRITURE : deal_room_version.script_naturalized (PAS campaigns.script_oral — celui-ci est V0 protégé).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { naturalizeScript } from "../_shared/script-to-speech.ts";
import { checkIdempotency, sha256Hex, storeIdempotency } from "../_shared/idempotency.ts";
import { logSystemFailure } from "../_shared/system-failures.ts";

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
    const body = await req.json();
    const { campaign_id, deal_room_version_id, script } = body;
    if (!campaign_id || !deal_room_version_id || !script) {
      return json({ error: "campaign_id, deal_room_version_id et script sont requis" }, 400);
    }

    // Idempotency (Q5/Q6)
    const idemKey = req.headers.get("Idempotency-Key") ?? `tts1:${deal_room_version_id}:${await sha256Hex(script)}`;
    const bodyHash = await sha256Hex(JSON.stringify({ campaign_id, deal_room_version_id, script }));
    const idem = await checkIdempotency({ supabase, key: idemKey, scope: "transform-script-to-speech-v1", bodyHash, campaign_id });
    if ("conflict" in idem && idem.conflict) {
      return json({ error: "idempotency_conflict", message: "This idempotency key was used with a different request body", cached_body_hash: idem.cached_body_hash, current_body_hash: idem.current_body_hash }, 409);
    }
    if ("hit" in idem && idem.hit) return json(idem.cached_response, 200);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not set");

    const { scriptOral, tokensIn, tokensOut } = await naturalizeScript({ script, apiKey });

    // Write to deal_room_version (NEVER campaigns.script_oral — V0 protected)
    const { error: updErr } = await supabase
      .from("deal_room_version")
      .update({
        script_naturalized: scriptOral,
        updated_at: new Date().toISOString(),
        metadata: { tokens_in: tokensIn, tokens_out: tokensOut, naturalized_at: new Date().toISOString() },
      })
      .eq("id", deal_room_version_id);
    if (updErr) throw updErr;

    const response = { ok: true, script_naturalized: scriptOral };
    await storeIdempotency({ supabase, key: idemKey, scope: "transform-script-to-speech-v1", bodyHash, response, campaign_id });
    return json(response, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("transform-script-to-speech-v1 error:", msg);
    await logSystemFailure({ supabase, failure_type: "tts_v1_error", severity: "medium", reason: { error_code: "tts_v1_runtime", provider: "internal", attempt_n: 1, request_id: null, deal_room_version_id: null } });
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
