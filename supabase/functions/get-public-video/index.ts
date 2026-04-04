import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LABEL_FR: Record<string, string> = {
  intro: "Présentation",
  pricing: "Proposition commerciale",
  technical: "Détails techniques",
  closing: "Éléments de clôture",
  other: "Document complémentaire",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { campaign_id } = body;

    if (!campaign_id || typeof campaign_id !== "string" || !UUID_REGEX.test(campaign_id)) {
      return new Response(JSON.stringify({ error: "Valid campaign_id (UUID) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [assetRes, allAssetsRes, videoRes, campaignRes, agentCtxRes] =
      await Promise.all([
        supabase.from("deal_assets")
          .select("id, asset_type, file_url, version_number, parent_asset_id, asset_purpose")
          .eq("campaign_id", campaign_id).eq("asset_status", "active")
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("deal_assets")
          .select("id, asset_type, file_url, asset_purpose")
          .eq("campaign_id", campaign_id).eq("asset_status", "active")
          .order("created_at", { ascending: true }),
        supabase.from("videos").select("id")
          .eq("campaign_id", campaign_id).eq("is_active", true)
          .limit(1).maybeSingle(),
        supabase.from("campaigns")
          .select("name, description, deal_owner_id, created_by_user_id, deal_experience_mode, metadata")
          .eq("id", campaign_id).single(),
        supabase.from("agent_context")
          .select("stage, decision_window, incumbent_type")
          .eq("campaign_id", campaign_id).maybeSingle(),
      ]);

    const asset = assetRes.data;
    const allAssets = allAssetsRes.data || [];
    const campaign = campaignRes.data;
    const agentCtx = agentCtxRes.data;
    const meta = (campaign?.metadata as Record<string, unknown>) || {};

    // AE identity — via profiles.created_by_user_id (deal_owner_id toujours null en D1)
    let ae_name = "", ae_initials = "";
    if (campaign?.created_by_user_id) {
      const { data: ae } = await supabase.from("profiles")
        .select("first_name, last_name")
        .eq("user_id", campaign.created_by_user_id)
        .maybeSingle();
      if (ae?.first_name || ae?.last_name) {
        ae_name = [ae.first_name, ae.last_name].filter(Boolean).join(" ").trim();
        ae_initials = ae_name.split(" ")
          .map((w: string) => w[0] || "").join("").toUpperCase().slice(0, 2);
      }
    }

    const video_id = (!asset || asset.asset_type === "video")
      ? (videoRes.data?.id ?? null) : null;

    // prospect_message — priorité : metadata > description > généré
    const prospect_message =
      ((meta.prospect_message as string) || "").trim() ||
      (campaign?.description || "").trim() ||
      "J'ai rassemblé les points clés pour vous.";

    // summary_bullets — priorité : AE-written > générés
    const purposes = allAssets.map((a: { asset_purpose: string }) => a.asset_purpose);
    let summary_bullets: string[] = [];
    const metaBullets = meta.summary_bullets as string[] | undefined;
    if (metaBullets?.length) {
      summary_bullets = metaBullets.filter((b) => b?.trim()).slice(0, 3);
    } else {
      const gen: string[] = [];
      if (agentCtx?.decision_window && gen.length < 3) {
        const d = new Date(agentCtx.decision_window);
        gen.push(`Décision attendue le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`);
      }
      if (purposes.includes("pricing") && gen.length < 3)
        gen.push("Proposition commerciale incluse");
      if (purposes.includes("technical") && gen.length < 3)
        gen.push("Réponse technique disponible");
      if (agentCtx?.incumbent_type === "competitor_named" && gen.length < 3)
        gen.push("Analyse concurrentielle préparée");
      if ((meta.deal_value as number) && gen.length < 3)
        gen.push("Estimation budgétaire pour votre périmètre");
      summary_bullets = gen;
    }

    // context_bullets (Pour avancer sur ce sujet)
    const context_bullets: string[] = [];
    if (agentCtx?.decision_window && context_bullets.length < 3) {
      const d = new Date(agentCtx.decision_window);
      context_bullets.push(`Décision attendue le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`);
    }
    if (purposes.includes("pricing") && context_bullets.length < 3)
      context_bullets.push("Proposition commerciale disponible");
    if (purposes.includes("technical") && context_bullets.length < 3)
      context_bullets.push("Réponse technique incluse");
    if (agentCtx?.incumbent_type === "competitor_named" && context_bullets.length < 3)
      context_bullets.push("Analyse concurrentielle préparée");
    if ((meta.deal_value as number) && context_bullets.length < 3)
      context_bullets.push("Estimation budgétaire pour votre périmètre");
    if (["close", "negotiation"].includes(agentCtx?.stage || "") && context_bullets.length < 3)
      context_bullets.push("Points de validation finale couverts");

    // secondary_assets
    const secondary_assets = allAssets
      .filter((a: { id: string }) => a.id !== asset?.id)
      .slice(0, 4)
      .map((a: { id: string; asset_type: string; asset_purpose: string; file_url: string }) => ({
        id: a.id,
        asset_type: a.asset_type,
        asset_purpose: a.asset_purpose,
        file_url: a.file_url,
        label_fr: LABEL_FR[a.asset_purpose] || LABEL_FR.other,
      }));

    return new Response(JSON.stringify({
      video_id,
      asset_type: asset?.asset_type ?? null,
      version_number: asset?.version_number ?? null,
      file_url: asset?.file_url ?? null,
      parent_asset_id: asset?.parent_asset_id ?? null,
      campaign_name: campaign?.name ?? null,
      prospect_message,
      summary_bullets,
      context_bullets,
      ae_name,
      ae_initials,
      secondary_assets,
      experience_mode: campaign?.deal_experience_mode || "deal_room",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
