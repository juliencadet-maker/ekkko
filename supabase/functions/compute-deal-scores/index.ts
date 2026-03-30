import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch all viewers for this campaign
    const { data: viewers } = await supabase
      .from("viewers")
      .select("*")
      .eq("campaign_id", campaign_id);

    if (!viewers || viewers.length === 0) {
      // No data yet — insert a cold start score
      await supabase.from("deal_scores").insert({
        campaign_id,
        des: 0,
        viewer_count: 0,
        sponsor_count: 0,
        blocker_count: 0,
        avg_watch_depth: 0,
        breadth: 0,
        event_velocity: 0,
        momentum: "stalled",
        cold_start_regime: "cold_global",
        alerts: [],
      });

      return new Response(
        JSON.stringify({ des: 0, regime: "cold_global" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

      // Contact Score = watch_depth * 0.35 + replay_intensity * 0.20 + sharing * 0.25 + cta * 0.20
      const replayIntensity = Math.min(replays * 25, 100);
      const sharingScore = Math.min((shares * 30) + (viewersGen * 20), 100);
      const ctaScore = cta * 100;
      
      const contactScore = Math.round(
        watchDepth * 0.35 +
        replayIntensity * 0.20 +
        sharingScore * 0.25 +
        ctaScore * 0.20
      );

      // Sponsor Score = shares > 0 + viewersGen > 0 + watchDepth > 70
      const sponsorScore = Math.round(
        (shares > 0 ? 30 : 0) +
        (viewersGen > 0 ? 30 : 0) +
        (watchDepth > 70 ? 20 : watchDepth > 40 ? 10 : 0) +
        (cta ? 20 : 0)
      );

      // Blocker Score = inverse signals
      const daysSinceLastEvent = viewer.last_event_at
        ? (Date.now() - new Date(viewer.last_event_at).getTime()) / (1000 * 60 * 60 * 24)
        : 30;
      
      const blockerScore = Math.round(
        (watchDepth < 40 ? 30 : 0) +
        (shares === 0 && daysSinceLastEvent > 7 ? 25 : 0) +
        (replays === 0 && watchDepth < 60 ? 20 : 0) +
        (daysSinceLastEvent > 14 ? 25 : daysSinceLastEvent > 7 ? 15 : 0)
      );

      // Influence Score = viewersGen + shares weighted
      const influenceScore = Math.round(
        Math.min((viewersGen * 35) + (shares * 25), 100)
      );

      // Determine status
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
    const avgWatchDepth = viewers.reduce((sum, v) => sum + (v.total_watch_depth || 0), 0) / viewerCount;
    const sponsors = viewers.filter(v => (v.sponsor_score || 0) >= 60);
    const sponsorCount = sponsors.length;
    const blockers = viewers.filter(v => (v.blocker_score || 0) >= 50);
    const blockerCount = blockers.length;

    // Breadth = unique viewers / estimated committee size (heuristic: ACV-based)
    const estimatedCommitteeSize = Math.max(viewerCount, 6); // fallback minimum
    const breadth = Math.round((viewerCount / estimatedCommitteeSize) * 100);

    // Event Velocity = qualified events in last 7 days
    const qualifiedEventTypes = ["watch_progress", "segment_replayed", "page_shared", "cta_clicked", "video_completed"];
    const qualifiedEvents = (recentEvents || []).filter(e => qualifiedEventTypes.includes(e.event_type));
    const eventVelocity = qualifiedEvents.length;

    // Multi-threading = distinct domains with known viewers
    const distinctDomains = new Set(viewers.filter(v => v.domain).map(v => v.domain));
    const multiThreadingScore = distinctDomains.size;

    // DES = composite
    const avgContactScore = viewers.reduce((sum, v) => sum + (v.contact_score || 0), 0) / viewerCount;
    const sponsorBonus = Math.min(sponsorCount * 10, 20);
    const des = Math.round(
      avgContactScore * 0.35 +
      breadth * 0.20 +
      Math.min(eventVelocity * 3, 100) * 0.15 +
      sponsorBonus +
      Math.min(multiThreadingScore * 15, 100) * 0.10
    );

    // Momentum — compare to previous score
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
      if (delta > 5) momentum = "accelerating";
      else if (delta < -5) momentum = "decelerating";
      else if (delta < -15) momentum = "stalled";
    }

    // Alerts
    const alerts: { type: string; text: string }[] = [];
    
    // Silent blockers
    for (const b of blockers) {
      alerts.push({
        type: "danger",
        text: `${b.name || b.domain || "Contact inconnu"} — bloqueur potentiel (score ${b.blocker_score})`,
      });
    }

    // Silent sponsors (high watch but no shares)
    const silentSponsors = viewers.filter(v => (v.total_watch_depth || 0) > 60 && (v.share_count || 0) === 0);
    for (const s of silentSponsors) {
      if (s.is_known) {
        alerts.push({
          type: "warning",
          text: `${s.name || s.email} — engagement passif (${s.total_watch_depth}% vu, 0 partage)`,
        });
      }
    }

    // New contacts detected
    const newViewers = viewers.filter(v => {
      const daysSince = (Date.now() - new Date(v.first_seen_at || v.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    });
    if (newViewers.length > 0) {
      alerts.push({
        type: "info",
        text: `${newViewers.length} nouveau(x) contact(s) détecté(s) cette semaine`,
      });
    }

    // Cold start regime
    let coldStartRegime = "cold_global";
    if (viewerCount >= 5 && sponsorCount >= 2) coldStartRegime = "warm_account";
    else if (viewerCount >= 2) coldStartRegime = "cold_account";

    // Insert new deal score snapshot
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
      stage_signal_gap: null, // needs CRM stage data
      graph_centralization: null, // needs graph computation
    });

    return new Response(
      JSON.stringify({
        des,
        viewer_count: viewerCount,
        sponsor_count: sponsorCount,
        blocker_count: blockerCount,
        momentum,
        regime: coldStartRegime,
        alerts,
      }),
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
