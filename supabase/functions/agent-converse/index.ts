// Phase 1d.5h-fix — agent-converse with tool-calling loop + auth + persistence fixes.
// Multi-turn loop: Gemini → tool_calls → execute (READ parallel, WRITE serial)
//   → reinject tool results → Gemini → ... up to MAX_TOOL_ITER iterations.
//
// Auth model (post Phase 3-fix):
//   - Authorization: Bearer <token>
//   - if token === SUPABASE_SERVICE_ROLE_KEY → trusted internal caller (proxy ekko-agent),
//     body.user_id is accepted as-is.
//   - else → supabase.auth.getUser(token), 403 if body.user_id !== jwt.sub
//   - no token: legacy behaviour (treated as unauthenticated, no persistence).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeTimelineEvent } from "../_shared/timeline-events-writer.ts";
import {
  TOOL_HANDLERS,
  TOOL_DECLARATIONS,
  READ_TOOLS,
  type ToolContext,
  type ToolName,
} from "../_shared/agent-tools.ts";

// MAX_TOOL_ITER : env override possible pour tests (g)
const MAX_TOOL_ITER = (() => {
  const v = Number(Deno.env.get("MAX_TOOL_ITER") ?? "5");
  return Number.isFinite(v) && v > 0 && v <= 10 ? v : 5;
})();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT_TEMPLATE = `Tu es l'agent de deal intelligence d'Ekko — copilote AE enterprise.

CONTEXTE DU DEAL ACTIF (snapshot léger) :
{DEAL_CONTEXT}

OUTILS DISPONIBLES :
- read_deal_signals(campaign_id?, limit?) — faits + score récents
- read_power_map(campaign_id?) — buying committee + rôles
- read_timeline(campaign_id?, since?, event_layer?, limit?) — chronologie
- read_user_portfolio() — 20 deals actifs de l'AE
- log_declarative_signal(campaign_id?, label, payload?) — signal AE déclaré
- snooze_deal(campaign_id?, until, reason?) — pause un deal (max 30j)
- queue_notification(kind, title, body?, campaign_id?, payload?) — notif in-app à l'AE

RÈGLES TOOLS :
- Appelle un tool QUAND tu as besoin de données fraîches/précises ou de poser une action — pas pour faire joli.
- Tu peux enchaîner jusqu'à ${MAX_TOOL_ITER} tours d'outils. Au-delà, tu réponds avec ce que tu as.
- Pour WRITE (log_*, snooze_*, queue_*) : appelle UNIQUEMENT si l'AE l'a demandé explicitement ou implicitement.
- N'invente jamais d'IDs. Si campaign_id absent → tools utilisent le deal du contexte.

RÈGLES DE FOND (inchangées) :
1. Tu parles de CE deal, CES signaux, CET instant.
2. Distingue toujours fait observé / inférence / recommandation. Indique ton niveau de confiance.
3. Tu ne caches pas l'incertitude. Si tu ne sais pas, tu le dis.
4. Concis et direct. Pas de blabla. Pas de "bonne question".
5. Tu ne déclenches jamais d'action externe (email, Slack, appel). Tu proposes — l'AE exécute.
6. Tu ne contredis jamais un fait du moteur Ekko (DES, scores, alertes). Tu interprètes, jamais tu réfutes.
7. Si donnée insuffisante : "Pas assez de signaux pour orienter une action fiable pour le moment."

STYLE : 5-10 lignes max sauf demande explicite. Ton factuel, prescriptif quand les données le permettent.`;

interface ConverseInput {
  campaign_id: string;
  messages: Array<{ role: "user" | "assistant" | "system" | "tool"; content: string; tool_call_id?: string }>;
  user_id?: string | null;
  source?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ConverseInput;
    const { campaign_id, messages, user_id: bodyUserId, source } = body;
    if (!campaign_id || !Array.isArray(messages)) {
      return json({ error: "campaign_id and messages required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ---------- AUTH ----------
    // Trusted-internal-caller pattern: SERVICE_ROLE bypass, otherwise validate JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let trustedInternalCaller = false;
    let resolvedUserId: string | null = bodyUserId ?? null;

    if (token && token === serviceRoleKey) {
      trustedInternalCaller = true; // proxy ekko-agent forwards with SERVICE_ROLE
    } else if (token) {
      const { data: userData, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !userData?.user) {
        return json({ error: "invalid token" }, 401);
      }
      if (bodyUserId && bodyUserId !== userData.user.id) {
        return json({ error: "user_id mismatch with JWT" }, 403);
      }
      resolvedUserId = userData.user.id;
    }
    // else: no token — accept (legacy/dev). resolvedUserId may be null → no persistence.

    // Resolve campaign + org
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, org_id, name, deal_stage, deal_status, deal_value, snoozed_until")
      .eq("id", campaign_id)
      .maybeSingle();
    if (cErr || !campaign) return json({ error: "campaign not found" }, 404);

    // Lightweight context snapshot
    const { data: latestScore } = await supabase
      .from("deal_scores")
      .select("des, momentum, viewer_count, days_since_last_signal, alerts")
      .eq("campaign_id", campaign_id)
      .order("scored_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const dealContext = {
      campaign_id,
      name: campaign.name,
      deal_stage: campaign.deal_stage,
      deal_status: campaign.deal_status,
      des: latestScore?.des ?? null,
      momentum: latestScore?.momentum ?? "stable",
      viewer_count: latestScore?.viewer_count ?? 0,
      days_since_last_signal: latestScore?.days_since_last_signal ?? null,
      alerts_count: Array.isArray(latestScore?.alerts) ? (latestScore!.alerts as any[]).length : 0,
    };

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{DEAL_CONTEXT}", JSON.stringify(dealContext, null, 2));

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) return json({ error: "AI not configured" }, 500);

    // ---------- Tool loop ----------
    const toolCtx: ToolContext | null = resolvedUserId
      ? {
        supabase,
        user_id: resolvedUserId,
        org_id: campaign.org_id,
        campaign_id,
        via: "agent-converse",
      }
      : null;

    const convo: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content, ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}) })),
    ];

    let iter = 0;
    let finalReply = "";
    const allToolCalls: Array<{ name: string; args: any; result: any }> = [];
    let maxIterReached = false;

    while (iter < MAX_TOOL_ITER) {
      iter++;
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          max_tokens: 1500,
          messages: convo,
          tools: toolCtx ? TOOL_DECLARATIONS : undefined,
          tool_choice: toolCtx ? "auto" : undefined,
        }),
      });
      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("[agent-converse] AI error:", errText);
        return json({ error: "AI request failed", details: errText.slice(0, 500) }, 502);
      }
      const aiData = await aiResp.json();
      const choice = aiData.choices?.[0];
      const message = choice?.message;
      const toolCalls = message?.tool_calls;

      if (!toolCalls || toolCalls.length === 0 || !toolCtx) {
        finalReply = message?.content ?? "Erreur de réponse de l'agent.";
        convo.push({ role: "assistant", content: finalReply });
        break;
      }

      convo.push({
        role: "assistant",
        content: message.content ?? "",
        tool_calls: toolCalls,
      });

      const reads: any[] = [];
      const writes: any[] = [];
      for (const tc of toolCalls) {
        const name = tc.function?.name as ToolName;
        if (READ_TOOLS.has(name)) reads.push(tc);
        else writes.push(tc);
      }

      const execOne = async (tc: any) => {
        const name = tc.function?.name as ToolName;
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* keep empty */ }
        const handler = TOOL_HANDLERS[name];
        let result: any;
        if (!handler) {
          result = { ok: false, error: `unknown tool: ${name}` };
        } else {
          try {
            result = await handler(toolCtx!, args);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "tool exception";
            result = { ok: false, error: msg };
          }
        }
        allToolCalls.push({ name, args, result });
        return { tool_call_id: tc.id, content: JSON.stringify(result) };
      };

      const readResults = await Promise.all(reads.map(execOne));
      const writeResults: any[] = [];
      for (const w of writes) writeResults.push(await execOne(w));

      const byId = new Map<string, any>();
      [...readResults, ...writeResults].forEach((r) => byId.set(r.tool_call_id, r));
      for (const tc of toolCalls) {
        const r = byId.get(tc.id);
        if (r) convo.push({ role: "tool", tool_call_id: tc.id, content: r.content });
      }
    }

    // ---------- MAX_TOOL_ITER reached: log FIRST, then attempt wrap-up ----------
    if (iter >= MAX_TOOL_ITER && !finalReply) {
      maxIterReached = true;

      // Log to system_failures BEFORE wrap-up (must fire even if wrap-up fails)
      const { error: sfErr } = await supabase.from("system_failures").insert({
        failure_type: "execution",
        severity: "medium",
        message: "agent-converse: MAX_TOOL_ITER reached",
        campaign_id,
        reason: JSON.stringify({
          error_code: "agent_max_iter_reached",
          provider: "internal",
          attempt_n: iter,
          request_id: null,
          deal_room_version_id: null,
          timestamp_iso: new Date().toISOString(),
          tool_call_count: allToolCalls.length,
          tools_used: allToolCalls.map((t) => t.name),
        }),
      });
      if (sfErr) console.warn("[agent-converse] system_failures insert failed:", sfErr.message);

      // Wrap-up: force a final non-tool response
      const wrapResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          max_tokens: 800,
          messages: [
            ...convo,
            { role: "user", content: "Limite d'outils atteinte. Synthétise ce que tu as et conclus, sans appeler de tools." },
          ],
        }),
      });
      if (wrapResp.ok) {
        const wrapData = await wrapResp.json();
        finalReply = wrapData.choices?.[0]?.message?.content ?? "Limite d'analyse atteinte.";
      } else {
        finalReply = "Limite d'analyse atteinte sans réponse propre.";
      }
    }

    // ---------- Persistence (only if we have a resolvedUserId) ----------
    if (resolvedUserId) {
      // Upsert agent_conversations — use UNIQUE(campaign_id, user_id), return id directly
      const { data: convRow, error: convErr } = await supabase
        .from("agent_conversations")
        .upsert(
          {
            campaign_id,
            user_id: resolvedUserId,
            context_snapshot: { ...dealContext, tool_calls_made: allToolCalls.length, max_iter_reached: maxIterReached },
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            surface: source ?? "direct",
          },
          { onConflict: "campaign_id,user_id", ignoreDuplicates: false },
        )
        .select("id")
        .maybeSingle();
      if (convErr) {
        console.warn("[agent-converse] agent_conversations upsert failed:", convErr.message);
        await supabase.from("system_failures").insert({
          failure_type: "execution",
          severity: "low",
          message: "agent-converse: agent_conversations upsert failed",
          campaign_id,
          reason: JSON.stringify({ error: convErr.message, timestamp_iso: new Date().toISOString() }),
        });
      }

      const conversation_id = convRow?.id;
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (conversation_id && lastUser) {
        const { error: msgErr } = await supabase.from("agent_messages").insert([
          {
            conversation_id,
            role: "user",
            content: lastUser.content,
            surface: source ?? "direct",
          },
          {
            conversation_id,
            role: "assistant",
            content: finalReply,
            surface: source ?? "direct",
            tool_calls: allToolCalls.length > 0 ? allToolCalls.map((t) => ({ name: t.name, args: t.args })) : null,
            tool_results: allToolCalls.length > 0 ? allToolCalls.map((t) => ({ name: t.name, ok: t.result?.ok })) : null,
            metadata: { iter, max_iter_reached: maxIterReached, internal_caller: trustedInternalCaller },
          },
        ]);
        if (msgErr) console.warn("[agent-converse] agent_messages insert failed:", msgErr.message);
      }

      // Audit timeline
      await writeTimelineEvent(supabase, "agent-converse", {
        campaign_id,
        org_id: campaign.org_id,
        event_type: "agent_message",
        event_layer: "fact",
        actor_user_id: resolvedUserId,
        event_data: {
          source: source ?? "direct",
          tool_calls: allToolCalls.length,
          max_iter_reached: maxIterReached,
          tools_used: allToolCalls.map((t) => t.name),
          internal_caller: trustedInternalCaller,
        },
      });
    }

    return json({
      reply: finalReply,
      context: { des: dealContext.des, viewer_count: dealContext.viewer_count, momentum: dealContext.momentum },
      tool_calls: allToolCalls.length,
      max_iter_reached: maxIterReached,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("agent-converse error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
