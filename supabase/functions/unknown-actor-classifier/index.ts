// unknown-actor-classifier — RSC PowerMap (D106-R11)
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5i-A1.
// Classification domaines inconnus (consulting, fund, board, competitor...).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface UnknownActorClassifierInput { domain: string; }
export interface UnknownActorClassifierOutput { domain_category: string; confidence: number; }

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ message: "shell_only", filled_in: "1d.5i-A1" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
