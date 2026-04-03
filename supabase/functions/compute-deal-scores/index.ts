import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If "all", compute for all active campaigns
    let campaignIds: string[] = [];
    if (campaign_id === "all") {
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id")
        .in("status", ["draft", "pending_approval", "approved", "generating", "completed"]);
      campaignIds = (campaigns || []).map((c: any) => c.id);
    } else if (campaign_id) {
      campaignIds = [campaign_id];
    } else {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const cid of campaignIds) {
      const result = await computeForCampaign(supabase, cid);
      results.push(result);
    }

    return new Response(
      JSON.stringify({ computed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Compute scores error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// FONCTION 1 : Calcul du risk_level
function computeRiskLevel(score: any): 'healthy' | 'watch' | 'critical' {
  const des = score.des ?? 50;
  const momentum = score.momentum;
  const sponsorCount = score.sponsor_count ?? 0;
  const blockerCount = score.blocker_count ?? 0;
  const daysSinceSignal = score.days_since_last_signal ?? 0;

  if (des < 35) return 'critical';
  if (blockerCount > 0 && sponsorCount === 0) return 'critical';
  if (momentum === 'declining' && des < 50) return 'critical';
  if (daysSinceSignal > 10) return 'critical';
  if (des < 55) return 'watch';
  if (momentum === 'declining') return 'watch';
  if (sponsorCount === 0) return 'watch';
  if (blockerCount > 0) return 'watch';
  if (daysSinceSignal > 5) return 'watch';
  return 'healthy';
}

// FONCTION 2 : Calcul du priority_score (0-100)
function computePriorityScore(score: any): number {
  const urgency = score.risk_level === 'critical' ? 40 :
    score.risk_level === 'watch' ? 20 : 5;
  const recency = (score.days_since_last_signal ?? 99) < 1 ? 30 :
    (score.days_since_last_signal ?? 99) < 3 ? 20 :
    (score.days_since_last_signal ?? 99) < 7 ? 10 : 0;
  const momentumScore = score.momentum === 'declining' ? 20 :
    score.momentum === 'rising' ? 5 : 10;
  const nbaScore = score.recommended_action_v2 ? 10 : 0;
  return Math.min(100, urgency + recency + momentumScore + nbaScore);
}

async function computeForCampaign(supabase: any, campaign_id: string) {
  // ── 1. FETCH INITIAL EN PARALLÈLE ──────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [campaignRes, agentCtxRes, viewersRes, recentVideoRes, recentDocRes, prevScoreRes, dealAssetsRes] = await Promise.all([
    supabase.from("campaigns")
      .select("org_id, deal_value, deal_status, deal_risk_override, first_signal_at, committee_size_declared, deal_owner_id")
      .eq("id", campaign_id).single(),
    supabase.from("agent_context")
      .select("stage, decision_window, incumbent_present, incumbent_type, committee_size_declared")
      .eq("campaign_id", campaign_id).maybeSingle(),
    supabase.from("viewers")
      .select("id, contact_score, sponsor_score, blocker_score, total_watch_depth, last_event_at, title, domain, share_count, viewers_generated")
      .eq("campaign_id", campaign_id),
    supabase.from("video_events")
      .select("event_type, created_at")
      .eq("campaign_id", campaign_id)
      .gte("created_at", sevenDaysAgo),
    supabase.from("asset_page_events")
      .select("asset_id, time_spent_seconds, created_at")
      .eq("campaign_id", campaign_id)
      .gte("created_at", sevenDaysAgo),
    supabase.from("deal_scores")
      .select("des")
      .eq("campaign_id", campaign_id)
      .order("scored_at", { ascending: false })
      .limit(1),
    supabase.from("deal_assets")
      .select("id, asset_type, asset_purpose")
      .eq("campaign_id", campaign_id)
      .eq("asset_status", "active"),
  ]);

  const campaign = campaignRes.data;
  const agentCtx = agentCtxRes.data;
  const viewers = viewersRes.data || [];
  const recentVideo = recentVideoRes.data || [];
  const recentDoc = recentDocRes.data || [];
  const prevScore = (prevScoreRes.data || [])[0] ?? null;
  const dealAssets = dealAssetsRes.data || [];

  if (!campaign) {
    console.error("[C1a][computeForCampaign] campaign not found:", campaign_id);
    return { campaign_id, error: "campaign not found" };
  }

  // ── 2. daysSinceSignal MULTI-SOURCE (asset-agnostic V1) ────────────
  const [lastVideoRes, lastDocRes] = await Promise.all([
    supabase.from("video_events").select("created_at")
      .eq("campaign_id", campaign_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("asset_page_events").select("created_at")
      .eq("campaign_id", campaign_id)
      .gt("time_spent_seconds", 5)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const videoTs = lastVideoRes.data?.created_at ? new Date(lastVideoRes.data.created_at).getTime() : 0;
  const docTs = lastDocRes.data?.created_at ? new Date(lastDocRes.data.created_at).getTime() : 0;
  const lastSignalTs = Math.max(videoTs, docTs);
  const daysSinceSignal = lastSignalTs > 0
    ? Math.floor((Date.now() - lastSignalTs) / 86400000)
    : 999;

  // ── 3. STAGE ───────────────────────────────────────────────────────
  const rawStage = agentCtx?.stage ?? null;
  const hasStage = rawStage !== null;
  const stage: "Early" | "Mid" | "Late" =
    rawStage === "negotiation" || rawStage === "close" ? "Late"
    : rawStage === "rfp" || rawStage === "shortlist" ? "Mid"
    : "Early";

  // ── 4. qualifiedEvents MULTI-SOURCE (asset-agnostic V1) ────────────
  const qualifiedVideoTypes = ["watch_progress", "segment_replayed", "cta_clicked", "video_completed"];
  const qualifiedVideoCount = recentVideo.filter(
    (e: any) => qualifiedVideoTypes.includes(e.event_type)
  ).length;
  const qualifiedDocCount = recentDoc.filter(
    (e: any) => (e.time_spent_seconds ?? 0) > 5
  ).length;
  const eventVelocity = qualifiedVideoCount + qualifiedDocCount;

  // ── 5. DES STAGE-AWARE ─────────────────────────────────────────────
  // Priorité committee_size : agent_context (déclaratif AE) → campaigns (fallback) → 6 (défaut)
  const committeeSize = agentCtx?.committee_size_declared ?? campaign.committee_size_declared ?? 6;

  const uniqueActiveContacts = viewers.filter(
    (v: any) => (v.contact_score ?? 0) > 0
  ).length;
  const breadth = Math.min(uniqueActiveContacts / Math.max(committeeSize, 3), 1.0);

  const avgWatchDepth = viewers.length > 0
    ? viewers.reduce((s: number, v: any) => s + (v.total_watch_depth ?? 0), 0) / viewers.length
    : 0;
  const depth = avgWatchDepth / 100;
  const velocity = Math.min(eventVelocity / 10, 1.0);

  const lambda = stage === "Late" ? 0.08 : stage === "Mid" ? 0.04 : 0.02;
  const recency = Math.exp(-lambda * daysSinceSignal);

  const distinctDomains = new Set(
    viewers.filter((v: any) => v.domain).map((v: any) => v.domain)
  ).size;
  // threading : heuristique V1 par domaine — proxy faible, amélioré en C1b avec layers
  const threading = Math.min(distinctDomains / Math.max(committeeSize, 3), 1.0);

  const weights = stage === "Late"
    ? { b: 0.15, d: 0.30, v: 0.20, r: 0.25, t: 0.10 }
    : stage === "Mid"
    ? { b: 0.25, d: 0.25, v: 0.20, r: 0.15, t: 0.15 }
    : { b: 0.35, d: 0.20, v: 0.20, r: 0.10, t: 0.15 };

  const DES = Math.round(
    (breadth * weights.b + depth * weights.d + velocity * weights.v +
     recency * weights.r + threading * weights.t) * 100
  );

  // ── 6. MOMENTUM ────────────────────────────────────────────────────
  const prevDES = prevScore?.des ?? null;
  const momentum = prevDES === null ? "stable"
    : DES - prevDES > 5 ? "rising"
    : DES - prevDES < -5 ? "declining"
    : "stable";

  // ── 7. CONTRADICTIONS C1-C10 ───────────────────────────────────────
  const incumbentMultiplier =
    (agentCtx?.incumbent_present && agentCtx?.incumbent_type === "competitor_named") ? 1.5 : 1.0;

  const sponsors = viewers.filter((v: any) => (v.sponsor_score ?? 0) >= 60);
  const maxBlocker = viewers.length > 0
    ? Math.max(0, ...viewers.map((v: any) => v.blocker_score ?? 0))
    : 0;
  const silenceSeuil = stage === "Late" ? 5 : stage === "Mid" ? 7 : 10;

  // newDealRiskOverride calculé ICI — avant C4 qui en dépend
  // TEMPORAIRE C1a — approximation par titre. Remplacé par layer scoring en C1b.
  const execFinanceTitles = ["CEO", "CFO", "COO", "DG", "PDG", "DAF", "Directeur Financier"];
  const silentExecFinance = viewers.some((v: any) => {
    if (!v.title) return false;
    const match = execFinanceTitles.some(t =>
      (v.title as string).toLowerCase().includes(t.toLowerCase())
    );
    if (!match) return false;
    const daysSinceViewer = v.last_event_at
      ? (Date.now() - new Date(v.last_event_at).getTime()) / 86400000
      : 999;
    return daysSinceViewer > 0.7 * Math.max(daysSinceSignal, 1);
  });
  const newDealRiskOverride = campaign.deal_risk_override || silentExecFinance;

  // C7/C8 — documents uniquement en C1a
  // C7/C8 vidéo : granularité asset insuffisante en C1a — traité en C1b
  const criticalDocAssets = dealAssets.filter(
    (a: any) => ["pricing", "closing"].includes(a.asset_purpose) && a.asset_type === "document"
  );
  const criticalDocIds = criticalDocAssets.map((a: any) => a.id);
  let openedDocAssetIds = new Set<string>();
  if (criticalDocIds.length > 0) {
    const { data: docOpened } = await supabase
      .from("asset_page_events").select("asset_id")
      .in("asset_id", criticalDocIds).gt("time_spent_seconds", 5);
    (docOpened || []).forEach((e: any) => openedDocAssetIds.add(e.asset_id));
  }
  const pricingDocOpened = criticalDocIds.some(id => openedDocAssetIds.has(id));

  const active: any[] = [];

  // C1 — Sponsor actif + silence en phase Late
  if (hasStage && stage === "Late" && sponsors.length > 0 && daysSinceSignal > 10) {
    active.push({ contradiction_id: "C1", severity: "high",
      message: `Sponsor actif mais silence depuis ${daysSinceSignal}j en phase ${rawStage}`,
      signal_a: `sponsors: ${sponsors.length}`, signal_b: `silence: ${daysSinceSignal}j` });
  }
  // C2 — Contacts sans sponsor
  if (viewers.length > 3 && sponsors.length === 0) {
    active.push({ contradiction_id: "C2", severity: "medium",
      message: `${viewers.length} contacts identifiés, aucun sponsor détecté`,
      signal_a: `viewers: ${viewers.length}`, signal_b: "sponsor_count: 0" });
  }
  // C3 — Activité + engagement en baisse
  if (eventVelocity > 0 && momentum === "declining" && DES < 50) {
    active.push({ contradiction_id: "C3", severity: "high",
      message: "Activité récente mais engagement en baisse",
      signal_a: `velocity: ${eventVelocity}`, signal_b: `DES: ${DES}` });
  }
  // C4 — Bloqueur + engagement faible (utilise newDealRiskOverride)
  if (newDealRiskOverride || (maxBlocker > 70 && avgWatchDepth < 25 && daysSinceSignal > silenceSeuil)) {
    active.push({ contradiction_id: "C4", severity: "medium",
      message: `Bloqueur potentiel détecté — engagement faible depuis ${daysSinceSignal}j`,
      signal_a: `max_blocker: ${maxBlocker}`, signal_b: `avg_watch: ${Math.round(avgWatchDepth)}%` });
  }
  // C5 — Engagement profond sans partage
  const maxDepth = viewers.length > 0
    ? Math.max(0, ...viewers.map((v: any) => v.total_watch_depth ?? 0))
    : 0;
  const anyShare = viewers.some((v: any) => (v.share_count ?? 0) > 0);
  const anyViewersGen = viewers.some((v: any) => (v.viewers_generated ?? 0) > 0);
  if (maxDepth > 75 && !anyShare && !anyViewersGen) {
    active.push({ contradiction_id: "C5", severity: "low",
      message: "Contact très engagé mais aucun partage",
      signal_a: `max_depth: ${maxDepth}%`, signal_b: "partages: 0" });
  }
  // C6 — Deal élevé, 1 seul contact actif en Late
  const uniqueActive = viewers.filter((v: any) => (v.contact_score ?? 0) > 0).length;
  if (hasStage && stage === "Late" && uniqueActive === 1 && (campaign.deal_value ?? 0) > 50000) {
    active.push({ contradiction_id: "C6", severity: "high",
      message: `Deal ${Math.round((campaign.deal_value ?? 0) / 1000)}k€ en phase finale — 1 seul contact actif`,
      signal_a: "contacts_actifs: 1", signal_b: `valeur: ${campaign.deal_value}` });
  }
  // C7 — Document critique envoyé non consulté en Late
  // S'applique uniquement aux assets document critiques (C1a)
  if (hasStage && stage === "Late" && daysSinceSignal > 5 && criticalDocAssets.length > 0 && !pricingDocOpened) {
    const sev: "high" | "medium" = incumbentMultiplier > 1 ? "high" : "medium";
    active.push({ contradiction_id: "C7", severity: sev,
      message: "Asset pricing/closing (document) envoyé mais non consulté en phase finale",
      signal_a: `assets_doc_critiques: ${criticalDocAssets.length}`, signal_b: `silence: ${daysSinceSignal}j` });
  }
  // C8 — Aucune consultation pricing en Late (angle distinct de C7)
  // C7 et C8 peuvent coexister : C7 = envoi sans retour, C8 = absence d'engagement pricing
  if (hasStage && stage === "Late" && criticalDocAssets.length > 0 && !pricingDocOpened) {
    active.push({ contradiction_id: "C8", severity: "high",
      message: "Aucune consultation de document pricing détectée en phase finale",
      signal_a: "pricing_doc: jamais ouvert", signal_b: `stage: ${rawStage}` });
  }
  // C9 — Activité forte, profondeur faible
  if (eventVelocity > 5 && avgWatchDepth < 30) {
    active.push({ contradiction_id: "C9", severity: "medium",
      message: "Forte activité mais faible profondeur — engagement superficiel",
      signal_a: `events_7d: ${eventVelocity}`, signal_b: `avg_depth: ${Math.round(avgWatchDepth)}%` });
  }
  // C10 — Sur-engagement unique
  const contactScores = viewers.map((v: any) => v.contact_score ?? 0);
  const maxContact = contactScores.length > 0 ? Math.max(0, ...contactScores) : 0;
  const indexOfMax = contactScores.indexOf(maxContact);
  const othersScores = contactScores.filter((_: number, i: number) => i !== indexOfMax);
  const othersAvg = othersScores.length > 0
    ? othersScores.reduce((a: number, b: number) => a + b, 0) / othersScores.length
    : 0;
  if (maxContact > 80 && othersAvg < 30 && viewers.length > 1) {
    active.push({ contradiction_id: "C10", severity: "high",
      message: "1 contact sur-engagé, les autres inactifs — risque thread unique",
      signal_a: `max_contact: ${maxContact}`, signal_b: `avg_autres: ${Math.round(othersAvg)}` });
  }

  // ── 8. UPSERT CONTRADICTIONS + DÉSACTIVATION ───────────────────────
  const activeIds = active.map((c: any) => c.contradiction_id);
  if (active.length > 0) {
    await supabase.from("deal_contradictions").upsert(
      active.map((c: any) => ({ ...c, campaign_id, org_id: campaign.org_id, is_active: true })),
      { onConflict: "campaign_id,contradiction_id" }
    );
  }
  // Guard : évite SQL invalide NOT IN ()
  if (activeIds.length > 0) {
    await supabase.from("deal_contradictions")
      .update({ is_active: false, resolved_at: new Date().toISOString() })
      .eq("campaign_id", campaign_id).eq("is_active", true)
      .not("contradiction_id", "in", `(${activeIds.map((id: string) => `'${id}'`).join(",")})`);
  } else {
    await supabase.from("deal_contradictions")
      .update({ is_active: false, resolved_at: new Date().toISOString() })
      .eq("campaign_id", campaign_id).eq("is_active", true);
  }

  // ── 9. INSIGHT PRIORITY SCORE + ALERTS ─────────────────────────────
  const impactMap: Record<string, number> = {
    C7: 1.0, C8: 1.0, C10: 1.0, C3: 0.8, C6: 0.8,
    C1: 0.7, C4: 0.7, C2: 0.4, C9: 0.4, C5: 0.3,
  };
  const sevScoreMap: Record<string, number> = { high: 1.0, medium: 0.6, low: 0.3 };
  const recencyFactor = Math.exp(-0.05 * daysSinceSignal);

  const scored = active.map((c: any) => ({
    ...c,
    insight_priority_score:
      (impactMap[c.contradiction_id] ?? 0.4) *
      (sevScoreMap[c.severity] ?? 0.4) *
      recencyFactor * 0.8,
  })).sort((a: any, b: any) => b.insight_priority_score - a.insight_priority_score);

  const alerts = scored.slice(0, 2).map((c: any, i: number) => ({
    type: i === 0 ? "primary" : "secondary",
    contradiction_id: c.contradiction_id,
    message: c.message,
    insight_priority_score: c.insight_priority_score,
  }));

  // ── 10. PRIORITY SCORES ────────────────────────────────────────────
  const severityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
  // incumbentMultiplier appliqué uniquement sur C7 et C8 (contrat canonique)
  const contradictionSeverity = active.reduce(
    (sum: number, c: any) =>
      sum + (severityMap[c.severity] ?? 1) *
      (["C7", "C8"].includes(c.contradiction_id) ? incumbentMultiplier : 1),
    0
  );
  const momentum_decay = momentum === "declining" ? 0.8 : momentum === "rising" ? 0.2 : 0.5;
  const daysRemaining = agentCtx?.decision_window
    ? Math.floor((new Date(agentCtx.decision_window).getTime() - Date.now()) / 86400000)
    : null;
  const decision_window_score = daysRemaining !== null
    ? Math.max(0, 1 - daysRemaining / 90)
    : 0;

  const priority_score = Math.round(
    (100 - DES) * 0.35 +
    momentum_decay * 100 * 0.30 +
    Math.min(contradictionSeverity * 20, 100) * 0.20 +
    decision_window_score * 100 * 0.15
  );

  // Priority Deal Score — orgMedian borné V1
  // DOCTRINE : orgMedian est une heuristique de normalisation inter-deals, non une vérité business.
  // Médiane d'échantillon sur les 100 deals récents. À refactorer si volume org > 200 deals.
  const { data: orgDeals } = await supabase
    .from("campaigns").select("deal_value")
    .eq("org_id", campaign.org_id)
    .not("deal_value", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  const orgValues = ((orgDeals || []).map((d: any) => Number(d.deal_value)) as number[])
    .filter(v => v > 0).sort((a, b) => a - b);
  const orgMedian = orgValues.length > 0
    ? orgValues[Math.floor(orgValues.length / 2)]
    : 50000;
  const deal_value_weight = orgMedian > 0
    ? Math.max(0.5, Math.min(2.0, (campaign.deal_value ?? 0) / orgMedian))
    : 1.0;
  const recency_weight = Math.exp(-0.1 * daysSinceSignal);
  const priority_deal_score =
    Math.round(priority_score * deal_value_weight * recency_weight * 10) / 10;

  // ── 11. DEAL RISK LEVEL + OVERRIDE ─────────────────────────────────
  const hasHighContradiction = active.some((c: any) => c.severity === "high");

  const deal_risk_level = newDealRiskOverride ? "high_risk"
    : (daysSinceSignal > 14 && campaign.deal_status === "observing") ? "stale"
    : hasHighContradiction ? "high_risk"
    : null; // null = conserver valeur existante

  // ── 12. UPDATE CAMPAIGNS ───────────────────────────────────────────
  const campaignUpdates: Record<string, any> = {};
  if (newDealRiskOverride !== campaign.deal_risk_override)
    campaignUpdates.deal_risk_override = newDealRiskOverride;
  if (deal_risk_level !== null)
    campaignUpdates.deal_risk_level = deal_risk_level;
  // first_signal_at asset-agnostic : déclenché dès qu'un signal observé existe
  if (!campaign.first_signal_at && lastSignalTs > 0) {
    campaignUpdates.first_signal_at = new Date(lastSignalTs).toISOString();
    campaignUpdates.deal_status = "observing";
  }
  if (Object.keys(campaignUpdates).length > 0) {
    await supabase.from("campaigns").update(campaignUpdates).eq("id", campaign_id);
  }

  // ── 13. INSERT DEAL SCORES ─────────────────────────────────────────
  await supabase.from("deal_scores").insert({
    campaign_id,
    des: DES,
    viewer_count: viewers.length,
    sponsor_count: sponsors.length,
    blocker_count: viewers.filter((v: any) => (v.blocker_score ?? 0) > 70).length,
    avg_watch_depth: Math.round(avgWatchDepth),
    breadth: Math.round(breadth * 100),
    event_velocity: eventVelocity,
    multi_threading_score: distinctDomains,
    momentum,
    days_since_last_signal: daysSinceSignal,
    risk_level: deal_risk_level ?? (DES < 35 ? "critical" : DES < 55 ? "watch" : "healthy"),
    priority_score,
    priority_deal_score,
    alerts,
    cold_start_regime: viewers.length === 0 ? "cold_global"
      : viewers.length < 2 ? "cold_account"
      : "warm_account",
  });

  // ── 14. CHURN SIGNAL ───────────────────────────────────────────────
  // DÉCISION PRODUIT V1 : churn_signals = signal d'adoption org-level (pas deal-level)
  // Granularité deal-level : gérée par deal_triggers en E2
  if (daysSinceSignal > 30 && campaign.deal_status === "observing" && campaign.deal_owner_id) {
    const { data: existingChurn } = await supabase.from("churn_signals").select("id")
      .eq("org_id", campaign.org_id)
      .eq("signal_type", "no_assets")
      .is("resolved_at", null).limit(1);
    if (!existingChurn || existingChurn.length === 0) {
      await supabase.from("churn_signals").insert({
        org_id: campaign.org_id,
        user_id: campaign.deal_owner_id,
        risk_level: "medium",
        signal_type: "no_assets",
      });
    }
  }

  return {
    campaign_id, DES, stage, momentum, priority_score, priority_deal_score,
    contradictions: activeIds, deal_risk_level, daysSinceSignal,
  };
}
