// Phase 1d.5d-2 — Unified payload Cockpit + Inbox + Momentum
// SoT: campaigns + deal_scores + timeline_events + deal_triggers + prospect_room_questions
// AE-scoped via JWT; org isolation via org_memberships
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Json = Record<string, any>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(url, service);

    // Fetch membership for org scope + role + last_inbox_seen_at (Phase 1d.5e D78-C)
    const { data: membership } = await admin
      .from("org_memberships")
      .select("org_id, role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "no_org" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("last_inbox_seen_at")
      .eq("user_id", userId)
      .maybeSingle();
    const lastInboxSeenAt: string | null = profile?.last_inbox_seen_at ?? null;

    const orgId = membership.org_id as string;
    const role = membership.role as string;
    // VP/manager/admin see all org deals; org_user sees only their owned deals
    const seeAll = ["org_owner", "org_admin", "org_manager"].includes(role);

    // Fetch active deals scoped to AE
    let q = admin
      .from("campaigns")
      .select(
        "id, company_display_name, deal_status, deal_risk_level, deal_value, crm_stage, deal_owner_id, updated_at",
      )
      .eq("org_id", orgId)
      .neq("deal_status", "closed")
      .neq("deal_status", "draft")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (!seeAll) q = q.eq("deal_owner_id", userId);
    const { data: deals = [] } = await q;

    const dealIds = (deals || []).map((d: any) => d.id);

    // Latest deal_scores per deal (single batch + JS pick latest)
    let scoresByDeal: Record<string, any> = {};
    if (dealIds.length) {
      const { data: scores = [] } = await admin
        .from("deal_scores")
        .select(
          "campaign_id, des, priority_score, risk_level, trajectory, momentum, days_since_last_signal, recommended_action_v2, scored_at",
        )
        .in("campaign_id", dealIds)
        .order("scored_at", { ascending: false })
        .limit(2000);
      for (const s of scores || []) {
        if (!scoresByDeal[s.campaign_id]) scoresByDeal[s.campaign_id] = s;
      }
    }

    // Cross-deal recent fact events (Inbox feed) — last 7d
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString();
    let inboxEvents: any[] = [];
    if (dealIds.length) {
      const { data: ev = [] } = await admin
        .from("timeline_events")
        .select(
          "id, campaign_id, event_type, event_data, event_layer, created_at",
        )
        .in("campaign_id", dealIds)
        .eq("event_layer", "fact")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(60);
      inboxEvents = ev || [];
    }

    // Pending prospect questions cross-deals
    let pendingQuestions = 0;
    if (dealIds.length) {
      const { count } = await admin
        .from("prospect_room_questions")
        .select("*", { count: "exact", head: true })
        .in("campaign_id", dealIds)
        .in("ae_status", ["new"])
        .contains("metadata", { kind: "qa" });
      pendingQuestions = count || 0;
    }

    // Active triggers cross-deals (not acted)
    let activeTriggers: any[] = [];
    if (dealIds.length) {
      const { data: trigs = [] } = await admin
        .from("deal_triggers")
        .select(
          "id, campaign_id, trigger_type, priority_score, message_what, message_why, message_action, delivered_at",
        )
        .in("campaign_id", dealIds)
        .is("acted_on_at", null)
        .order("priority_score", { ascending: false })
        .limit(40);
      activeTriggers = trigs || [];
    }

    // Build cockpit groupings
    const enriched = (deals || []).map((d: any) => {
      const s = scoresByDeal[d.id] || {};
      return {
        id: d.id,
        company: d.company_display_name || "—",
        deal_status: d.deal_status,
        risk_level: s.risk_level || d.deal_risk_level || "healthy",
        des: s.des ?? null,
        priority_score: s.priority_score ?? 0,
        trajectory: s.trajectory ?? "stable",
        momentum: s.momentum ?? null,
        days_since_last_signal: s.days_since_last_signal ?? null,
        recommended_action: s.recommended_action_v2 ?? null,
        crm_stage: d.crm_stage,
        deal_value: d.deal_value,
        updated_at: d.updated_at,
      };
    });

    const top_priority = [...enriched]
      .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
      .slice(0, 5);

    const at_risk = enriched.filter(
      (d) => d.risk_level === "at_risk" || d.risk_level === "critical",
    );

    const observing = enriched.filter((d) => d.deal_status === "observing");

    const moving = enriched
      .filter((d) => d.trajectory === "accelerating" || d.trajectory === "rising")
      .slice(0, 10);

    const silent = enriched
      .filter((d) => (d.days_since_last_signal ?? 0) >= 14)
      .sort(
        (a, b) =>
          (b.days_since_last_signal || 0) - (a.days_since_last_signal || 0),
      )
      .slice(0, 10);

    const payload: Json = {
      meta: {
        generated_at: new Date().toISOString(),
        scope: seeAll ? "org" : "ae",
        deal_count: enriched.length,
      },
      cockpit: {
        top_priority,
        moving,
        at_risk,
        observing,
        silent,
      },
      inbox: {
        events: inboxEvents,
        pending_questions: pendingQuestions,
        active_triggers: activeTriggers,
        new_signals_count: inboxEvents.length,
        last_seen_at: lastInboxSeenAt,
        new_since_visit: lastInboxSeenAt
          ? inboxEvents.filter((e: any) => e.created_at > lastInboxSeenAt).length
          : inboxEvents.length,
      },
      momentum: {
        accelerating: enriched.filter((d) => d.trajectory === "accelerating").length,
        stable: enriched.filter((d) => d.trajectory === "stable").length,
        slipping: enriched.filter((d) => d.trajectory === "slipping" || d.trajectory === "falling").length,
      },
      badges: {
        new_signals: inboxEvents.length,
        new_since_visit: lastInboxSeenAt
          ? inboxEvents.filter((e: any) => e.created_at > lastInboxSeenAt).length
          : inboxEvents.length,
        pending_questions: pendingQuestions,
        active_triggers: activeTriggers.length,
        global_attention:
          (lastInboxSeenAt
            ? inboxEvents.filter((e: any) => e.created_at > lastInboxSeenAt).length
            : inboxEvents.length) + pendingQuestions + activeTriggers.length,
      },
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "internal", detail: String((e as Error).message) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
