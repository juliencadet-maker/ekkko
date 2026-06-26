// external-signal-classifier — Veille externe (D106-R8 + M29)
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5n.
// Classifie pertinence (high/medium/low) + time_sensitivity des news/changes.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface ExternalSignalClassifierInput { event_id: string; event_table: "external_news_events" | "external_people_changes"; }
export interface ExternalSignalClassifierOutput { classified_relevance: string; time_sensitivity: string; confidence: number; }

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ message: "shell_only", filled_in: "1d.5n" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
