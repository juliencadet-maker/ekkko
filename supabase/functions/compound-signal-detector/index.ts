// compound-signal-detector — Signaux composites (M38)
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5j.
// Détecte combinaisons de signaux atomiques → compound_signals (buying_intent, hot_stakeholder...).
// Force-trigger pattern correspondant sans attendre cycle normal.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface CompoundSignalDetectorInput { deal_id: string; org_id: string; }
export interface CompoundSignalDetectorOutput { compound_signals_detected: number; }

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ compound_signals_detected: 0, message: "shell_only", filled_in: "1d.5j" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
