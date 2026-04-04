import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      campaign_id, org_id, deal_name, priority_score,
      days_since_signal, deal_status, contradictions,
      ae_user_id, decision_window, viewer_count, declared_count,
    } = await req.json();

    if (!campaign_id || !org_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id and org_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GARDE 1 : Signal minimum ──────────────────────────────────────
    if ((viewer_count ?? 0) < 2 && (declared_count ?? 0) === 0) {
      return new Response(
        JSON.stringify({ success: true, triggered_count: 0, reason: "insufficient_signal" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GARDE 2 : Top 3 org (1 seule logique propre) ─────────────────
    const { data: orgCampaigns } = await supabase
      .from("campaigns")
      .select("id")
      .eq("org_id", org_id)
      .eq("deal_status", "observing");
    const orgCampaignIds = (orgCampaigns || []).map((c: any) => c.id);

    if (orgCampaignIds.length >= 3) {
      // Fetch tous les snapshots pour ces deals
      // Déduplication JS : garder uniquement le snapshot le plus récent par campaign_id
      const { data: allScores } = await supabase
        .from("deal_scores")
        .select("campaign_id, priority_deal_score, scored_at")
        .in("campaign_id", orgCampaignIds)
        .order("scored_at", { ascending: false });

      // Dédup : première occurrence = plus récente (ordre DESC garanti)
      const latestScoreByDeal = new Map();
      for (const s of (allScores || [])) {
        if (!latestScoreByDeal.has(s.campaign_id)) {
          latestScoreByDeal.set(s.campaign_id, s.priority_deal_score ?? 0);
        }
      }

      // Top 3 par priority_deal_score
      const top3Ids = [...latestScoreByDeal.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);

      if (!top3Ids.includes(campaign_id)) {
        return new Response(
          JSON.stringify({ success: true, triggered_count: 0, reason: "not_top3" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── GARDE 3 : Cap daily (uniquement si ae_user_id connu) ─────────
    // Note : deal_triggers n'a pas de colonne destinataire en E2.
    // Approximation V1 : compter les triggers sur les deals de l'org.
    if (ae_user_id) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("deal_triggers")
        .select("id", { count: "exact", head: true })
        .in("campaign_id", orgCampaignIds)
        .not("delivered_at", "is", null)
        .gt("delivered_at", startOfDay.toISOString());
      if ((count ?? 0) >= 5) {
        return new Response(
          JSON.stringify({ success: true, triggered_count: 0, reason: "daily_cap" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // Si ae_user_id null → pas de cap daily, continuer

    // ── FERMETURE BOUCLE STALE ────────────────────────────────────────
    // CONVENTION E2 V1 : acted_on_at sert ici de marquage "périmé par nouveau signal".
    // Sémantique provisoire — sera séparé de "vraie action AE" en E3.
    if ((days_since_signal ?? 999) === 0) {
      await supabase
        .from("deal_triggers")
        .update({ acted_on_at: new Date().toISOString() })
        .eq("campaign_id", campaign_id)
        .is("acted_on_at", null);
    }

    // ── SÉLECTION 1 TRIGGER PAR PRIORITÉ STRICTE ─────────────────────
    let selected: {
      trigger_type: string;
      message_what: string;
      message_why: string;
      message_action: string;
    } | null = null;

    // Priorité 1 : signal critique
    if ((priority_score ?? 0) > 65 && (contradictions ?? []).length > 0) {
      selected = {
        trigger_type: "signal",
        message_what: `Signal critique — ${(contradictions as string[])[0]}`,
        message_why: `Contradiction active détectée sur ce deal`,
        message_action: "Ouvrir le deal pour voir l'action recommandée",
      };
    }
    // Priorité 2 : time (decision_window = valeur AE-declared via agent_context)
    else if (decision_window) {
      const daysRemaining = Math.floor(
        (new Date(decision_window).getTime() - Date.now()) / 86400000
      );
      if (daysRemaining >= 0 && daysRemaining <= 7) {
        selected = {
          trigger_type: "time",
          message_what: `Fenêtre de décision dans ${daysRemaining}j`,
          message_why: `Échéance décision : ${new Date(decision_window).toLocaleDateString("fr-FR")}`,
          message_action: "Agir avant la fenêtre",
        };
      }
    }
    // Priorité 3 : silence
    else if ((days_since_signal ?? 0) > 7 && deal_status === "observing") {
      selected = {
        trigger_type: "silence",
        message_what: `${days_since_signal}j sans signal`,
        message_why: `Aucun engagement détecté côté prospect`,
        message_action: "Mettre à jour le contexte deal",
      };
    }

    if (!selected) {
      return new Response(
        JSON.stringify({ success: true, triggered_count: 0, reason: "no_condition_met" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ANTI-BRUIT 4H ─────────────────────────────────────────────────
    const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("deal_triggers")
      .select("id")
      .eq("campaign_id", campaign_id)
      .eq("trigger_type", selected.trigger_type)
      .gt("created_at", fourHoursAgo)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, triggered_count: 0, reason: "cooldown_active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── A. INSERT deal_triggers ───────────────────────────────────────
    // Colonnes disponibles : campaign_id, trigger_type, owner_type,
    // message_what, message_why, message_action, priority_score,
    // delivered_at, acted_on_at, created_at — rien d'autre.
    const { data: trigger, error: triggerError } = await supabase
      .from("deal_triggers")
      .insert({
        campaign_id,
        trigger_type: selected.trigger_type,
        owner_type: "ae",
        message_what: selected.message_what,
        message_why: selected.message_why,
        message_action: selected.message_action,
        priority_score: priority_score ?? 0,
        delivered_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (triggerError) {
      console.error("[deal-trigger-notify] Insert failed:", triggerError);
      return new Response(
        JSON.stringify({ success: false, error: "insert_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── B. Slack AE (uniquement si canal configuré) ───────────────────
    const slackMessage =
      `*${deal_name}* — ${selected.message_what}\n` +
      `${selected.message_why}\n` +
      `_Ekko · Qu'est-ce qui s'est passé ?_`;

    const { data: orgData } = await supabase
      .from("orgs")
      .select("metadata")
      .eq("id", org_id)
      .maybeSingle();
    const slackChannel = (orgData?.metadata as any)?.slack_ae_channel ?? null;

    if (slackChannel) {
      try {
        await supabase.functions.invoke("slack-helper", {
          body: { action: "post_message", channel_name: slackChannel, text: slackMessage },
        });
      } catch (slackErr) {
        await supabase.from("system_failures").insert({
          campaign_id,
          failure_type: "execution",
          severity: "low",
          message: "Slack trigger delivery failed",
          reason: String(slackErr),
        }).catch(() => {});
      }
    } else {
      // Pas de canal configuré → in-app uniquement
      await supabase.from("system_failures").insert({
        campaign_id,
        failure_type: "execution",
        severity: "low",
        message: "Slack channel not configured — in-app only",
        reason: "org.metadata.slack_ae_channel is null",
      }).catch(() => {});
    }

    // ── C. INSERT notifications (in-app) ─────────────────────────────
    if (ae_user_id) {
      await supabase.from("notifications").insert({
        user_id: ae_user_id,
        org_id,
        title: deal_name,
        message: selected.message_what,
        type: "deal_trigger",
        entity_type: "campaign",
        entity_id: campaign_id,
        is_read: false,
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true, triggered_count: 1, trigger_id: trigger.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[deal-trigger-notify] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
