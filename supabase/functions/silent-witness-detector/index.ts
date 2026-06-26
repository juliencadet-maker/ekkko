// silent-witness-detector — RSC PowerMap (D106-R11)
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5j.
// Détection viewers récurrents jamais identifiés en réunion (silent witnesses).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface SilentWitnessDetectorInput { account_id: string; org_id: string; }
export interface SilentWitnessDetectorOutput { silent_witnesses: unknown[]; }

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ silent_witnesses: [], message: "shell_only", filled_in: "1d.5j" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
