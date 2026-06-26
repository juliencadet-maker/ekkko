// external-news-fetcher — Veille externe Source 3 (D106-R8)
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5n.
// Fetch news publiques (RSS, press releases) → external_news_events.
// Toujours hypothétique (truth_layer='fact' mais classified_relevance jamais 'certitude').

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface ExternalNewsFetcherInput { account_id: string; org_id: string; }
export interface ExternalNewsFetcherOutput { events_ingested: number; }

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ events_ingested: 0, message: "shell_only", filled_in: "1d.5n" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
