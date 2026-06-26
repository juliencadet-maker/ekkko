// action-orchestrator — L3 Execution Engine (D106)
// Règle moteur M27 + M40 — voir _shared/engine-rules-v2c-d106.md
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5i-C.
// Consomme pattern_matches → prépare pending_external_actions (AE en contrôle qualité D99).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface ActionOrchestratorInput {
  pattern_match_id: string;
  org_id: string;
}

export interface ActionOrchestratorOutput {
  action_prepared: boolean;
  pending_external_action_id?: string;
  exec_allocation_result?: "allowed" | "upgrade_required" | "budget_exhausted";
  fallback_action?: string;
}

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ action_prepared: false, message: "shell_only", filled_in: "1d.5i-C" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
