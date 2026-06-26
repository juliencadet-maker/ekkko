// exec-allocation-arbitrator — Executive Presence Budget (D113 + D116)
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5j.
// Arbitre les demandes d'intervention exec selon executive_presence_budget par rôle.
// Préserve la rareté → préserve la crédibilité du levier exec.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface ExecAllocationArbitratorInput {
  org_id: string;
  deal_id: string;
  executive_role: string;
  arme_type: string;
  pattern_code: string;
}

export interface ExecAllocationArbitratorOutput {
  decision: "allowed" | "upgrade_required" | "budget_exhausted";
  remaining_budget?: number;
  fallback_action?: string;
}

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ decision: "allowed", message: "shell_only", filled_in: "1d.5j" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
