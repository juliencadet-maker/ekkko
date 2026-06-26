// external-people-changes-detector — Veille externe (D106-R8)
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5n.
// Détection mouvements personnes côté compte → external_people_changes.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface ExternalPeopleChangesDetectorInput { account_id: string; org_id: string; }
export interface ExternalPeopleChangesDetectorOutput { changes_detected: number; }

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ changes_detected: 0, message: "shell_only", filled_in: "1d.5n" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
