// Phase 1c-3 — FORK of get-public-video (v1).
// v3 differences:
//  - Reads media from `deal_room_version` (the active version) instead of `campaigns.script_oral`/`videos`.
//  - Returns 1h signed URLs from `deal-room-audio` and `deal-room-video` buckets.
//  - Enforces 90-day Deal Room retention (D41) → 410 Gone past TTL.
//  - Same viewer-token D2 contract as v1.
//  - v1 stays untouched and serves prod for any org without the `deal_room_v15` flag.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SEC = 3600; // 1h
const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

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
    const { campaign_id, viewer_hash: incomingHash } = body;

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

    // Active Deal Room version = source of truth for media in V1.5.
    const { data: drv, error: drvErr } = await supabase
      .from("deal_room_version")
      .select("id, deal_room_id, version_number, script_naturalized, audio_storage_path, video_storage_path, audio_status, video_status, audio_duration_ms, video_duration_ms, created_at")
      .eq("campaign_id", campaign_id)
      .eq("is_active", true)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drvErr) {
      console.error("[v3] deal_room_version lookup failed", drvErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!drv) {
      return new Response(JSON.stringify({ error: "No active Deal Room version" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 90-day retention (D41).
    const createdAt = new Date(drv.created_at).getTime();
    if (Date.now() - createdAt > RETENTION_MS) {
      return new Response(
        JSON.stringify({
          error: "Deal Room expirée",
          message: "Cette Deal Room a dépassé la durée de conservation de 90 jours.",
        }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [allAssetsRes, campaignRes, agentCtxRes, knownViewersRes, contactRolesRes] =
      await Promise.all([
        supabase.from("deal_assets")
          .select("id, asset_type, file_url, asset_purpose")
          .eq("campaign_id", campaign_id).eq("asset_status", "active")
          .order("created_at", { ascending: true }),
        supabase.from("campaigns")
          .select("name, description, deal_owner_id, created_by_user_id, deal_experience_mode, metadata, company_display_name, org_id")
          .eq("id", campaign_id).single(),
        supabase.from("agent_context")
          .select("stage, decision_window, incumbent_type")
          .eq("campaign_id", campaign_id).maybeSingle(),
        supabase.from("viewers")
          .select("id, name, title, viewer_hash")
          .eq("campaign_id", campaign_id)
          .eq("is_known", true)
          .order("contact_score", { ascending: false, nullsFirst: false })
          .limit(8),
        supabase.from("deal_contact_roles")
          .select("viewer_id, layer")
          .eq("campaign_id", campaign_id),
      ]);

    const allAssets = allAssetsRes.data || [];
    const campaign = campaignRes.data;
    const agentCtx = agentCtxRes.data;
    const meta = (campaign?.metadata as Record<string, unknown>) || {};
    const knownViewers = knownViewersRes.data || [];
    const contactRoles = contactRolesRes.data || [];

    // Sign media URLs (1h TTL).
    let audio_signed_url: string | null = null;
    let video_signed_url: string | null = null;

    if (drv.audio_storage_path && drv.audio_status === "ready") {
      const { data: signed } = await supabase
        .storage.from("deal-room-audio")
        .createSignedUrl(drv.audio_storage_path, SIGNED_URL_TTL_SEC);
      audio_signed_url = signed?.signedUrl ?? null;
    }
    if (drv.video_storage_path && drv.video_status === "ready") {
      const { data: signed } = await supabase
        .storage.from("deal-room-video")
        .createSignedUrl(drv.video_storage_path, SIGNED_URL_TTL_SEC);
      video_signed_url = signed?.signedUrl ?? null;
    }

    const roleMap: Record<string, string> = Object.fromEntries(
      contactRoles.map((r: any) => [r.viewer_id, r.layer])
    );

    const known_contacts = knownViewers.map((v: any) => ({
      id: v.id,
      name: v.name || "Contact",
      title: v.title || null,
      layer: roleMap[v.id] || null,
    }));

    // Resolve viewer token (D2).
    let resolved_viewer = null;
    if (incomingHash && typeof incomingHash === "string") {
      const { data: rv } = await supabase
        .from("viewers")
        .select("id, name, email, title")
        .eq("campaign_id", campaign_id)
        .eq("viewer_hash", incomingHash)
        .maybeSingle();
      if (rv?.name) {
        const rvRole = contactRoles.find((r: any) => r.viewer_id === rv.id);
        resolved_viewer = {
          id: rv.id,
          name: rv.name,
          title: rv.title || null,
          email: rv.email || null,
          layer: rvRole?.layer || null,
        };
      }
    }

    const rawTopics = meta.topics_enabled as string[] | undefined;
    const topics_enabled = (rawTopics && rawTopics.length > 0)
      ? rawTopics
      : ["pricing", "technical", "deployment", "governance"];

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

    const prospect_message =
      ((meta.prospect_message as string) || "").trim() ||
      (campaign?.description || "").trim() ||
      "J'ai rassemblé les points clés pour vous.";

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

    const secondary_assets = allAssets
      .slice(0, 4)
      .map((a: { id: string; asset_type: string; asset_purpose: string; file_url: string }) => ({
        id: a.id,
        asset_type: a.asset_type,
        asset_purpose: a.asset_purpose,
        file_url: a.file_url,
        label_fr: LABEL_FR[a.asset_purpose] || LABEL_FR.other,
      }));

    return new Response(JSON.stringify({
      // V1.5 media (signed URLs from deal_room_version)
      deal_room_version_id: drv.id,
      deal_room_id: drv.deal_room_id,
      version_number: drv.version_number,
      script_spoken_text: drv.script_naturalized,
      audio_signed_url,
      video_signed_url,
      audio_duration_ms: drv.audio_duration_ms,
      video_duration_ms: drv.video_duration_ms,
      audio_status: drv.audio_status,
      video_status: drv.video_status,
      // Shared context (same shape as v1 for prospect UI compat)
      campaign_name: campaign?.name ?? null,
      company_display_name: campaign?.company_display_name ?? null,
      prospect_message,
      summary_bullets,
      context_bullets,
      ae_name,
      ae_initials,
      secondary_assets,
      experience_mode: campaign?.deal_experience_mode || "deal_room",
      known_contacts,
      resolved_viewer,
      topics_enabled,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[v3] error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
