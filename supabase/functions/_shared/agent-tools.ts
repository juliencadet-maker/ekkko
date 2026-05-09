// Phase 1d.5h — Phase 3: Agent tools layer.
// 7 handlers (4 READ + 3 WRITE) callable by the LLM via OpenAI-compatible
// function calling on the Lovable AI Gateway.
//
// Security model:
//   - Service-role client is used (RLS bypass) but every handler MUST validate
//     org_id == ctx.org_id before reading/writing campaign-scoped data.
//   - actor_user_id is ALWAYS taken from ctx, never from tool args.
//   - WRITE handlers audit via writeTimelineEvent.
//   - log_declarative_signal whitelists event_type to 'ae_offline_signal'.
//   - queue_notification rejects forbidden kinds (e.g. 'system_failure').
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeTimelineEvent } from "./timeline-events-writer.ts";

// ---------- Context passed by agent-converse to every tool ----------
export interface ToolContext {
  supabase: SupabaseClient;
  user_id: string;
  org_id: string;
  campaign_id?: string | null; // current deal scope, if applicable
  via: "agent-converse";
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

// ---------- Tiny inline validators (Zod-free, no external deps) ----------
function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function isNonEmptyString(v: unknown, max = 5000): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}
function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && !isNaN(Date.parse(v));
}

// Helper: enforce that campaign_id belongs to ctx.org_id
async function assertCampaignInOrg(
  ctx: ToolContext,
  campaignId: string,
): Promise<{ ok: true; org_id: string } | { ok: false; error: string }> {
  if (!isUuid(campaignId)) return { ok: false, error: "invalid campaign_id" };
  const { data, error } = await ctx.supabase
    .from("campaigns")
    .select("id, org_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) return { ok: false, error: `campaign lookup failed: ${error.message}` };
  if (!data) return { ok: false, error: "campaign not found" };
  if (data.org_id !== ctx.org_id) return { ok: false, error: "forbidden: cross-org" };
  return { ok: true, org_id: data.org_id };
}

// ============================================================
// READ tools
// ============================================================

// 1. read_deal_signals — recent timeline (fact) + last deal_scores
async function read_deal_signals(ctx: ToolContext, args: any): Promise<ToolResult> {
  const campaign_id: string = args?.campaign_id ?? ctx.campaign_id ?? "";
  const guard = await assertCampaignInOrg(ctx, campaign_id);
  if (!guard.ok) return guard;
  const limit = Math.min(Math.max(Number(args?.limit ?? 20), 1), 50);

  const [eventsRes, scoresRes] = await Promise.all([
    ctx.supabase
      .from("timeline_events")
      .select("id, event_type, event_layer, event_data, created_at")
      .eq("campaign_id", campaign_id)
      .eq("event_layer", "fact")
      .order("created_at", { ascending: false })
      .limit(limit),
    ctx.supabase
      .from("deal_scores")
      .select("des, momentum, viewer_count, sponsor_count, blocker_count, days_since_last_signal, alerts, scored_at")
      .eq("campaign_id", campaign_id)
      .order("scored_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (eventsRes.error) return { ok: false, error: eventsRes.error.message };
  return {
    ok: true,
    data: {
      campaign_id,
      latest_score: scoresRes.data ?? null,
      recent_facts: eventsRes.data ?? [],
    },
  };
}

// 2. read_power_map — viewers + roles, filtering low-confidence roles (<0.40)
async function read_power_map(ctx: ToolContext, args: any): Promise<ToolResult> {
  const campaign_id: string = args?.campaign_id ?? ctx.campaign_id ?? "";
  const guard = await assertCampaignInOrg(ctx, campaign_id);
  if (!guard.ok) return guard;

  const [viewersRes, rolesRes] = await Promise.all([
    ctx.supabase
      .from("viewers")
      .select("id, name, email, title, domain, status, total_watch_depth, sponsor_score, blocker_score, contact_score, influence_score, last_event_at")
      .eq("campaign_id", campaign_id)
      .order("contact_score", { ascending: false, nullsFirst: false })
      .limit(50),
    ctx.supabase
      .from("deal_contact_roles")
      .select("id, viewer_id, role, layer, source, source_confidence, insight_reasons")
      .eq("campaign_id", campaign_id)
      .is("deleted_at", null)
      .gte("source_confidence", 0.4),
  ]);

  if (viewersRes.error) return { ok: false, error: viewersRes.error.message };
  if (rolesRes.error) return { ok: false, error: rolesRes.error.message };
  return {
    ok: true,
    data: {
      campaign_id,
      viewers: viewersRes.data ?? [],
      roles: rolesRes.data ?? [],
    },
  };
}

// 3. read_timeline — paginated timeline events
async function read_timeline(ctx: ToolContext, args: any): Promise<ToolResult> {
  const campaign_id: string = args?.campaign_id ?? ctx.campaign_id ?? "";
  const guard = await assertCampaignInOrg(ctx, campaign_id);
  if (!guard.ok) return guard;

  const limit = Math.min(Math.max(Number(args?.limit ?? 30), 1), 100);
  const since: string | null = isIsoDate(args?.since) ? args.since : null;
  const layer: string | null =
    typeof args?.event_layer === "string" && ["fact", "inference", "declared"].includes(args.event_layer)
      ? args.event_layer
      : null;

  let q = ctx.supabase
    .from("timeline_events")
    .select("id, event_type, event_layer, event_data, actor_user_id, logged_via, created_at")
    .eq("campaign_id", campaign_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (since) q = q.gte("created_at", since);
  if (layer) q = q.eq("event_layer", layer);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { campaign_id, events: data ?? [] } };
}

// 4. read_user_portfolio — AE active deals, max 20
async function read_user_portfolio(ctx: ToolContext, _args: any): Promise<ToolResult> {
  const HARD_LIMIT = 20;

  // Total active deals owned by this AE in this org
  const { count: totalCount, error: cErr } = await ctx.supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.org_id)
    .eq("created_by_user_id", ctx.user_id)
    .not("deal_status", "in", "(closed,draft)");
  if (cErr) return { ok: false, error: cErr.message };

  // Top 20 deals — need scoring data, so join via deal_scores latest
  const { data: deals, error: dErr } = await ctx.supabase
    .from("campaigns")
    .select("id, name, deal_stage, deal_status, deal_value, snoozed_until, first_signal_at, updated_at")
    .eq("org_id", ctx.org_id)
    .eq("created_by_user_id", ctx.user_id)
    .not("deal_status", "in", "(closed,draft)")
    .limit(100); // overfetch then sort+slice
  if (dErr) return { ok: false, error: dErr.message };
  const ids = (deals ?? []).map((d: any) => d.id);
  if (ids.length === 0) {
    return { ok: true, data: { total_active: 0, listed: 0, deals: [], extra: 0 } };
  }

  const { data: scores, error: sErr } = await ctx.supabase
    .from("deal_scores")
    .select("campaign_id, des, priority_deal_score, days_since_last_signal, momentum, scored_at")
    .in("campaign_id", ids)
    .order("scored_at", { ascending: false });
  if (sErr) return { ok: false, error: sErr.message };

  // Keep only most recent score per campaign
  const latestByCampaign = new Map<string, any>();
  for (const s of scores ?? []) {
    if (!latestByCampaign.has(s.campaign_id)) latestByCampaign.set(s.campaign_id, s);
  }

  const enriched = (deals ?? []).map((d: any) => {
    const s = latestByCampaign.get(d.id) ?? {};
    return {
      campaign_id: d.id,
      name: d.name,
      deal_stage: d.deal_stage,
      deal_status: d.deal_status,
      deal_value: d.deal_value,
      des: s.des ?? null,
      priority_deal_score: s.priority_deal_score ?? 0,
      days_since_last_signal: s.days_since_last_signal ?? null,
      momentum: s.momentum ?? "stable",
    };
  });

  // Sort: priority_deal_score DESC, then days_since_last_signal DESC
  enriched.sort((a, b) => {
    const pa = a.priority_deal_score ?? 0;
    const pb = b.priority_deal_score ?? 0;
    if (pb !== pa) return pb - pa;
    const da = a.days_since_last_signal ?? -1;
    const db = b.days_since_last_signal ?? -1;
    return db - da;
  });

  const listed = enriched.slice(0, HARD_LIMIT);
  const total = totalCount ?? enriched.length;
  return {
    ok: true,
    data: {
      total_active: total,
      listed: listed.length,
      extra: Math.max(0, total - listed.length),
      deals: listed,
    },
  };
}

// ============================================================
// WRITE tools
// ============================================================

// 5. log_declarative_signal — INSERT timeline_events 'ae_offline_signal' (event_layer=declared)
async function log_declarative_signal(ctx: ToolContext, args: any): Promise<ToolResult> {
  const campaign_id: string = args?.campaign_id ?? ctx.campaign_id ?? "";
  const guard = await assertCampaignInOrg(ctx, campaign_id);
  if (!guard.ok) return guard;
  if (!isNonEmptyString(args?.label, 200)) return { ok: false, error: "label required (1..200 chars)" };
  const payload = (args?.payload && typeof args.payload === "object") ? args.payload : {};

  const res = await writeTimelineEvent(ctx.supabase, "agent-converse", {
    campaign_id,
    org_id: ctx.org_id,
    event_type: "ae_offline_signal", // whitelisted
    event_layer: "declared",
    actor_user_id: ctx.user_id,
    event_data: { label: args.label, ...payload, source: "agent_tool" },
  });
  if (!res.ok) return { ok: false, error: res.error ?? "insert failed" };
  return { ok: true, data: { timeline_event_id: res.id, label: args.label } };
}

// 6. snooze_deal — UPDATE campaigns.snoozed_until + audit
async function snooze_deal(ctx: ToolContext, args: any): Promise<ToolResult> {
  const campaign_id: string = args?.campaign_id ?? ctx.campaign_id ?? "";
  const guard = await assertCampaignInOrg(ctx, campaign_id);
  if (!guard.ok) return guard;
  if (!isIsoDate(args?.until)) return { ok: false, error: "until must be ISO date" };
  const until = new Date(args.until);
  if (until.getTime() <= Date.now()) return { ok: false, error: "until must be in the future" };
  // Cap snooze to 30 days
  const maxAt = Date.now() + 30 * 24 * 3600 * 1000;
  if (until.getTime() > maxAt) return { ok: false, error: "snooze cannot exceed 30 days" };

  const { error } = await ctx.supabase
    .from("campaigns")
    .update({ snoozed_until: until.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", campaign_id);
  if (error) return { ok: false, error: error.message };

  await writeTimelineEvent(ctx.supabase, "agent-converse", {
    campaign_id,
    org_id: ctx.org_id,
    event_type: "action_snoozed",
    event_layer: "declared",
    actor_user_id: ctx.user_id,
    event_data: { snoozed_until: until.toISOString(), reason: args?.reason ?? null, source: "agent_tool" },
  });

  return { ok: true, data: { campaign_id, snoozed_until: until.toISOString() } };
}

// 7. queue_notification — INSERT agent_notification_queue
const ALLOWED_NOTIF_KINDS = new Set(["agent_recommendation", "coaching_nudge", "external_action_pending"]);
async function queue_notification(ctx: ToolContext, args: any): Promise<ToolResult> {
  const kind: string = String(args?.kind ?? "");
  if (kind === "system_failure") return { ok: false, error: "forbidden kind: system_failure (system-only)" };
  if (!ALLOWED_NOTIF_KINDS.has(kind)) {
    return { ok: false, error: `invalid kind. Allowed: ${[...ALLOWED_NOTIF_KINDS].join(", ")}` };
  }
  if (!isNonEmptyString(args?.title, 200)) return { ok: false, error: "title required (1..200 chars)" };
  const body: string | null = isNonEmptyString(args?.body, 2000) ? args.body : null;
  const target_user_id: string = args?.user_id ?? ctx.user_id;
  if (!isUuid(target_user_id)) return { ok: false, error: "invalid target user_id" };
  // Only allow targeting the current AE (no cross-user spam from agent in 1d.5h)
  if (target_user_id !== ctx.user_id) {
    return { ok: false, error: "agent can only notify the current user in 1d.5h" };
  }

  let campaign_id: string | null = args?.campaign_id ?? ctx.campaign_id ?? null;
  if (campaign_id) {
    const guard = await assertCampaignInOrg(ctx, campaign_id);
    if (!guard.ok) return guard;
  }

  const { data, error } = await ctx.supabase
    .from("agent_notification_queue")
    .insert({
      user_id: target_user_id,
      org_id: ctx.org_id,
      campaign_id,
      kind,
      title: args.title,
      body,
      payload: { source: "agent_tool", ...(args?.payload && typeof args.payload === "object" ? args.payload : {}) },
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: { notification_id: data?.id, kind } };
}

// ============================================================
// Registry + OpenAI-compatible function declarations for Gemini
// ============================================================

export type ToolName =
  | "read_deal_signals"
  | "read_power_map"
  | "read_timeline"
  | "read_user_portfolio"
  | "log_declarative_signal"
  | "snooze_deal"
  | "queue_notification";

export const READ_TOOLS: Set<ToolName> = new Set(["read_deal_signals", "read_power_map", "read_timeline", "read_user_portfolio"]);

export const TOOL_HANDLERS: Record<ToolName, (ctx: ToolContext, args: any) => Promise<ToolResult>> = {
  read_deal_signals,
  read_power_map,
  read_timeline,
  read_user_portfolio,
  log_declarative_signal,
  snooze_deal,
  queue_notification,
};

// OpenAI-compatible tool declarations (Lovable AI Gateway speaks OpenAI schema)
export const TOOL_DECLARATIONS = [
  {
    type: "function",
    function: {
      name: "read_deal_signals",
      description: "Lit les signaux factuels récents et le dernier score (DES, momentum, alertes) d'un deal. Utilise-le quand tu veux confirmer des faits avant de raisonner.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "UUID du deal. Optionnel si déjà dans le contexte." },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_power_map",
      description: "Lit le buying committee d'un deal (viewers + rôles inférés avec confidence ≥ 0.40). Utilise-le pour analyser la couverture du comité.",
      parameters: {
        type: "object",
        properties: { campaign_id: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_timeline",
      description: "Lit la timeline d'un deal avec filtres (since, event_layer, limit). Utilise-le pour reconstituer une chronologie fine.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          since: { type: "string", description: "ISO date — événements strictement après." },
          event_layer: { type: "string", enum: ["fact", "inference", "declared"] },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_user_portfolio",
      description: "Liste les 20 deals actifs de l'AE courant, triés par priorité décroissante puis silence décroissant. Renvoie aussi le total et le nombre de deals non listés.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "log_declarative_signal",
      description: "Enregistre un signal déclaratif AE (contexte hors plateforme). event_type forcé à 'ae_offline_signal', event_layer 'declared'.",
      parameters: {
        type: "object",
        required: ["label"],
        properties: {
          campaign_id: { type: "string" },
          label: { type: "string", description: "Label court du signal (ex: 'meeting tenu avec CFO')." },
          payload: { type: "object", description: "Détails additionnels structurés." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "snooze_deal",
      description: "Met un deal en pause jusqu'à une date donnée (max 30j). Audit timeline_events 'action_snoozed'.",
      parameters: {
        type: "object",
        required: ["until"],
        properties: {
          campaign_id: { type: "string" },
          until: { type: "string", description: "ISO date future, max +30j." },
          reason: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queue_notification",
      description: "Met une notification in-app dans la queue de l'AE courant. Kinds autorisés: agent_recommendation, coaching_nudge, external_action_pending. Interdit: system_failure.",
      parameters: {
        type: "object",
        required: ["kind", "title"],
        properties: {
          kind: { type: "string", enum: ["agent_recommendation", "coaching_nudge", "external_action_pending"] },
          title: { type: "string" },
          body: { type: "string" },
          campaign_id: { type: "string" },
          payload: { type: "object" },
        },
      },
    },
  },
] as const;

export const MAX_TOOL_ITER = 5;
