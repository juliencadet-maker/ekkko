// asset-generator — L4 Execution Engine (D106)
// Doctrine arme D109 — voir _shared/engine-rules-v2c-d106.md
// STATUS : shell créé en 1d.5h-bis-NUKE. Logique remplie en 1d.5k.
// Pipeline génération par arme_type (video_ae, video_exec, booklet, atelier_roi...).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface AssetGeneratorInput {
  pending_external_action_id: string;
  arme_type:
    | "video_ae"
    | "video_exec"
    | "booklet"
    | "atelier_roi"
    | "point_alignement"
    | "message_personnalise"
    | "action_recherche";
}

export interface AssetGeneratorOutput {
  asset_id: string;
  asset_url?: string;
  generation_status: "success" | "failed" | "pending_review";
}

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ message: "shell_only", filled_in: "1d.5k" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
