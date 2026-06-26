// action-readiness-checker — Pre-NBA check (M31)
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5i-C.
// Avant proposer NBA, check action_readiness_score.
// Si < seuil → action différée OU action de collecte info à la place.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface ActionReadinessCheckerInput { deal_id: string; pattern_code: string; }
export interface ActionReadinessCheckerOutput { ready: boolean; score: number; fallback_action?: string; }

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ ready: false, score: 0, message: "shell_only", filled_in: "1d.5i-C" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
