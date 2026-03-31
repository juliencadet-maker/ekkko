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

// FONCTION 3 : Calcul et upsert des contradictions
async function upsertContradictions(supabase: any, campaignId: string, orgId: string, score: any, viewers: any[]) {
  const active: any[] = [];

  // C1 : Champion silencieux
  if ((score.sponsor_count ?? 0) > 0 && (score.days_since_last_signal ?? 0) > 7) {
    active.push({ contradiction_id: 'C1', severity: 'high',
      message: `Votre sponsor n'a plus eu d'activité depuis 7 jours`,
      signal_a: `sponsors actifs: ${score.sponsor_count}`,
      signal_b: `silence: ${score.days_since_last_signal} jours` });
  }

  // C2 : Vues sans sponsor identifié
  if ((score.viewer_count ?? 0) > 3 && (score.sponsor_count ?? 0) === 0) {
    active.push({ contradiction_id: 'C2', severity: 'medium',
      message: `${score.viewer_count} contacts ont visionné mais aucun sponsor n'est identifié`,
      signal_a: `viewer_count: ${score.viewer_count}`,
      signal_b: 'sponsor_count: 0' });
  }

  // C3 : DES qui chute malgré activité récente
  if ((score.event_velocity ?? 0) > 0 && score.momentum === 'declining' && (score.des ?? 100) < 50) {
    active.push({ contradiction_id: 'C3', severity: 'high',
      message: `L'engagement baisse malgré une activité récente — signal contradictoire`,
      signal_a: `event_velocity: ${score.event_velocity}`,
      signal_b: `momentum: declining, DES: ${score.des}` });
  }

  // C5 : Contact très engagé mais n'a pas partagé
  const heavyViewerNoShare = viewers.find((v: any) =>
    (v.replay_count || 0) > 3 && (v.total_watch_depth || 0) > 80 && !v.via_viewer_id);
  if (heavyViewerNoShare) {
    active.push({ contradiction_id: 'C5', severity: 'low',
      message: `${heavyViewerNoShare.name || 'Un contact'} est très engagé mais n'a pas partagé la vidéo`,
      signal_a: `replays: ${heavyViewerNoShare.replay_count}, complétion: ${heavyViewerNoShare.total_watch_depth}%`,
      signal_b: 'aucun partage détecté' });
  }

  // Désactiver les contradictions résolues
  const activeIds = active.map(c => c.contradiction_id);
  if (activeIds.length < 5) {
    await supabase.from('deal_contradictions')
      .update({ is_active: false, resolved_at: new Date().toISOString() })
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .not('contradiction_id', 'in', `(${activeIds.map((id: string) => `'${id}'`).join(',')})`);
  }

  // Upsert les contradictions actives
  if (active.length > 0) {
    await supabase.from('deal_contradictions').upsert(
      active.map(c => ({ ...c, campaign_id: campaignId, org_id: orgId, is_active: true })),
      { onConflict: 'campaign_id,contradiction_id' }
    );
  }
}

async function computeForCampaign(supabase: any, campaign_id: string) {
  // 1. Fetch all viewers for this campaign
  const { data: viewers } = await supabase
    .from("viewers")
    .select("*")
    .eq("campaign_id", campaign_id);

  if (!viewers || viewers.length === 0) {
    await supabase.from("deal_scores").insert({
      campaign_id,
      des: 0,
      viewer_count: 0,
      sponsor_count: 0,
      blocker_count: 0,
      avg_watch_depth: 0,
      breadth: 0,
      event_velocity: 0,
      momentum: "stable",
      cold_start_regime: "cold_global",
      alerts: [],
    });
    return { campaign_id, des: 0, regime: "cold_global" };
  }

  // 2. Fetch events from last 7 days for velocity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentEvents } = await supabase
    .from("video_events")
    .select("event_type, created_at, viewer_hash")
    .eq("campaign_id", campaign_id)
    .gte("created_at", sevenDaysAgo);

  // 3. Compute Contact Scores for each viewer
  for (const viewer of viewers) {
    const watchDepth = viewer.total_watch_depth || 0;
    const replays = viewer.replay_count || 0;
    const shares = viewer.share_count || 0;
    const cta = viewer.cta_clicked ? 1 : 0;
    const viewersGen = viewer.viewers_generated || 0;

    const replayIntensity = Math.min(replays * 25, 100);
    const sharingScore = Math.min((shares * 30) + (viewersGen * 20), 100);
    const ctaScore = cta * 100;
    
    const contactScore = Math.round(
      watchDepth * 0.35 +
      replayIntensity * 0.20 +
      sharingScore * 0.25 +
      ctaScore * 0.20
    );

    const sponsorScore = Math.round(
      (shares > 0 ? 30 : 0) +
      (viewersGen > 0 ? 30 : 0) +
      (watchDepth > 70 ? 20 : watchDepth > 40 ? 10 : 0) +
      (cta ? 20 : 0)
    );

    const daysSinceLastEvent = viewer.last_event_at
      ? (Date.now() - new Date(viewer.last_event_at).getTime()) / (1000 * 60 * 60 * 24)
      : 30;
    
    const blockerScore = Math.round(
      (watchDepth < 40 ? 30 : 0) +
      (shares === 0 && daysSinceLastEvent > 7 ? 25 : 0) +
      (replays === 0 && watchDepth < 60 ? 20 : 0) +
      (daysSinceLastEvent > 14 ? 25 : daysSinceLastEvent > 7 ? 15 : 0)
    );

    const influenceScore = Math.round(
      Math.min((viewersGen * 35) + (shares * 25), 100)
    );

    let status = viewer.status || "unknown";
    if (sponsorScore >= 60 && contactScore >= 50) status = "sponsor_actif";
    else if (blockerScore >= 50) status = "bloqueur_potentiel";
    else if (contactScore >= 30) status = "neutre";
    else if (viewer.is_known) status = "nouveau";
    else status = "inconnu";

    await supabase.from("viewers").update({
      contact_score: contactScore,
      sponsor_score: sponsorScore,
      influence_score: influenceScore,
      blocker_score: blockerScore,
      status,
      updated_at: new Date().toISOString(),
    }).eq("id", viewer.id);
  }

  // 4. Compute Deal-level scores
  const viewerCount = viewers.length;
  const avgWatchDepth = viewers.reduce((sum: number, v: any) => sum + (v.total_watch_depth || 0), 0) / viewerCount;
  const sponsors = viewers.filter((v: any) => (v.sponsor_score || 0) >= 60);
  const sponsorCount = sponsors.length;
  const blockers = viewers.filter((v: any) => (v.blocker_score || 0) >= 50);
  const blockerCount = blockers.length;

  const estimatedCommitteeSize = Math.max(viewerCount, 6);
  const breadth = Math.round((viewerCount / estimatedCommitteeSize) * 100);

  const qualifiedEventTypes = ["watch_progress", "segment_replayed", "page_shared", "cta_clicked", "video_completed"];
  const qualifiedEvents = (recentEvents || []).filter((e: any) => qualifiedEventTypes.includes(e.event_type));
  const eventVelocity = qualifiedEvents.length;

  const distinctDomains = new Set(viewers.filter((v: any) => v.domain).map((v: any) => v.domain));
  const multiThreadingScore = distinctDomains.size;

  const avgContactScore = viewers.reduce((sum: number, v: any) => sum + (v.contact_score || 0), 0) / viewerCount;
  const sponsorBonus = Math.min(sponsorCount * 10, 20);
  const des = Math.round(
    avgContactScore * 0.35 +
    breadth * 0.20 +
    Math.min(eventVelocity * 3, 100) * 0.15 +
    sponsorBonus +
    Math.min(multiThreadingScore * 15, 100) * 0.10
  );

  // Momentum
  const { data: prevScore } = await supabase
    .from("deal_scores")
    .select("des")
    .eq("campaign_id", campaign_id)
    .order("scored_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let momentum = "stable";
  if (prevScore) {
    const delta = des - (prevScore.des || 0);
    if (delta > 5) momentum = "rising";
    else if (delta < -5) momentum = "declining";
  }

  // Alerts
  const alerts: { type: string; text: string }[] = [];
  
  for (const b of blockers) {
    alerts.push({
      type: "danger",
      text: `${b.name || b.domain || "Contact inconnu"} — bloqueur potentiel (score ${b.blocker_score})`,
    });
  }

  const silentSponsors = viewers.filter((v: any) => (v.total_watch_depth || 0) > 60 && (v.share_count || 0) === 0);
  for (const s of silentSponsors) {
    if (s.is_known) {
      alerts.push({
        type: "warning",
        text: `${s.name || s.email} — engagement passif (${s.total_watch_depth}% vu, 0 partage)`,
      });
    }
  }

  const newViewers = viewers.filter((v: any) => {
    const daysSince = (Date.now() - new Date(v.first_seen_at || v.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  });
  if (newViewers.length > 0) {
    alerts.push({
      type: "info",
      text: `${newViewers.length} nouveau(x) contact(s) détecté(s) cette semaine`,
    });
  }

  // Recommended action
  let recommendedAction: any = null;
  if (blockerCount > 0 && sponsorCount === 0) {
    recommendedAction = {
      action: "address_blockers",
      label: "Traiter les bloqueurs — aucun sponsor identifié",
      cost: "élevé",
      priority: "high",
    };
  } else if (sponsorCount > 0 && viewerCount < 3) {
    recommendedAction = {
      action: "expand_committee",
      label: "Élargir le buying committee — seulement " + viewerCount + " contacts",
      cost: "moyen",
      priority: "high",
    };
  } else if (eventVelocity === 0 && viewerCount > 0) {
    recommendedAction = {
      action: "re_engage",
      label: "Relancer le deal — aucune activité sur 7 jours",
      cost: "faible",
      priority: "medium",
    };
  } else if (sponsorCount >= 2 && avgWatchDepth > 50) {
    recommendedAction = {
      action: "push_for_close",
      label: "Pousser vers la clôture — signaux favorables",
      cost: "moyen",
      priority: "high",
    };
  }

  // Cold start regime
  let coldStartRegime = "cold_global";
  if (viewerCount >= 5 && sponsorCount >= 2) coldStartRegime = "warm_account";
  else if (viewerCount >= 2) coldStartRegime = "cold_account";

  // Calculer days_since_last_signal
  const { data: lastEvent } = await supabase
    .from('video_events').select('created_at')
    .eq('campaign_id', campaign_id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  const daysSinceSignal = lastEvent
    ? Math.floor((Date.now() - new Date(lastEvent.created_at).getTime()) / 86400000)
    : 999;

  // Calculer risk_level et priority_score
  const scoreData: any = {
    des, momentum, sponsor_count: sponsorCount, blocker_count: blockerCount,
    viewer_count: viewerCount, event_velocity: eventVelocity,
    days_since_last_signal: daysSinceSignal, recommended_action_v2: recommendedAction,
  };
  const riskLevel = computeRiskLevel(scoreData);
  scoreData.risk_level = riskLevel;
  const priorityScore = computePriorityScore(scoreData);

  await supabase.from("deal_scores").insert({
    campaign_id,
    des,
    viewer_count: viewerCount,
    sponsor_count: sponsorCount,
    blocker_count: blockerCount,
    avg_watch_depth: Math.round(avgWatchDepth),
    breadth,
    event_velocity: eventVelocity,
    multi_threading_score: multiThreadingScore,
    momentum,
    cold_start_regime: coldStartRegime,
    alerts,
    recommended_action: recommendedAction,
    days_since_last_signal: daysSinceSignal,
    risk_level: riskLevel,
    priority_score: priorityScore,
  });

  // Get org_id for contradictions
  const { data: campaign } = await supabase
    .from('campaigns').select('org_id').eq('id', campaign_id).single();
  const orgId = campaign?.org_id;
  if (orgId) {
    await upsertContradictions(supabase, campaign_id, orgId, scoreData, viewers);
  }

  return { campaign_id, des, momentum, regime: coldStartRegime, risk_level: riskLevel, priority_score: priorityScore };
}
