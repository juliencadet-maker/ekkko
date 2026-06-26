// pattern-matcher — L2 Execution Engine (D106)
// Règle moteur M27 — voir _shared/engine-rules-v2c-d106.md
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5i-B.
// Consomme outputs L1 (compute-deal-scores) → produit pattern_matches.

import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface PatternMatcherInput {
  deal_id: string;
  org_id: string;
  trigger_source: "cron_5min" | "signal_new" | "declared_new" | "external_new" | "manual";
}

export interface PatternMatcherOutput {
  matches: Array<{
    pattern_code: string;
    confidence: number;
    triggered_at: string;
    contraindications_checked: string[];
    expected_window: { short_term: string; medium_term: string; long_term: string };
  }>;
  meta_pattern_fallback?: "SYSTEM_INSUFFICIENT_SIGNALS";
}

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ matches: [], message: "shell_only", filled_in: "1d.5i-B" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
