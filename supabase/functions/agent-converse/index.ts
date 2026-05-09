// Phase 4-fix — agent-converse with SSE streaming on the FINAL turn.
// Tool-calling iterations remain blocking (need tool results before next turn).
// Once Gemini returns no tool_calls, we re-issue the request with stream:true
// and pipe SSE chunks straight to the client.
// Custom events emitted by us (tool_call_start / tool_call_end) are interleaved
// in the SAME SSE stream so the AE sees progress live.
//
// Auth: same as Phase 3-fix (SERVICE_ROLE bypass + JWT validation otherwise).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { writeTimelineEvent } from "../_shared/timeline-events-writer.ts";
import {
  TOOL_HANDLERS,
  TOOL_DECLARATIONS,
  READ_TOOLS,
  type ToolContext,
  type ToolName,
} from "../_shared/agent-tools.ts";

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
- read_deal_signals(campaign_id?, limit?)
- read_power_map(campaign_id?)
- read_timeline(campaign_id?, since?, event_layer?, limit?)
- read_user_portfolio()
- log_declarative_signal(campaign_id?, label, payload?)
- snooze_deal(campaign_id?, until, reason?)
- queue_notification(kind, title, body?, campaign_id?, payload?)

RÈGLES TOOLS :
- Appelle un tool quand tu as besoin de données fraîches ou de poser une action.
- Tu peux enchaîner jusqu'à ${MAX_TOOL_ITER} tours d'outils.
- WRITE tools uniquement si l'AE le demande (explicitement ou implicitement).
- N'invente jamais d'IDs.

RÈGLES DE FOND :
1. Tu parles de CE deal, CES signaux, CET instant.
2. Distingue toujours fait observé / inférence / recommandation.
3. Tu n'inventes pas. Si tu ne sais pas, tu le dis.
4. Concis et direct. 5-10 lignes max sauf demande explicite.
5. Tu ne déclenches jamais d'action externe — tu proposes, l'AE valide.`;

interface ConverseInput {
  campaign_id: string;
  messages: Array<{ role: "user" | "assistant" | "system" | "tool"; content: string; tool_call_id?: string }>;
  user_id?: string | null;
  source?: string;
}

const encoder = new TextEncoder();
function sse(controller: ReadableStreamDefaultController<Uint8Array>, payload: unknown) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: ConverseInput;
  try {
    body = (await req.json()) as ConverseInput;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { campaign_id, messages, user_id: bodyUserId, source } = body;
  if (!campaign_id || !Array.isArray(messages)) {
    return json({ error: "campaign_id and messages required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let trustedInternalCaller = false;
  let resolvedUserId: string | null = bodyUserId ?? null;

  if (token && token === serviceRoleKey) {
    trustedInternalCaller = true;
  } else if (token) {
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData?.user) return json({ error: "invalid token" }, 401);
    if (bodyUserId && bodyUserId !== userData.user.id) {
      return json({ error: "user_id mismatch with JWT" }, 403);
    }
    resolvedUserId = userData.user.id;
  }

  // Campaign + score
  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, org_id, name, deal_stage, deal_status, deal_value, snoozed_until")
    .eq("id", campaign_id)
    .maybeSingle();
  if (cErr || !campaign) return json({ error: "campaign not found" }, 404);

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

  const toolCtx: ToolContext | null = resolvedUserId
    ? { supabase, user_id: resolvedUserId, org_id: campaign.org_id, campaign_id, via: "agent-converse" }
    : null;

  const convo: any[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content, ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}) })),
  ];

  const ALLOWED_SURFACES = new Set(["cockpit", "deal_compose", "prospect_drawer", "extension", "inbox", "slack"]);
  const surface = source && ALLOWED_SURFACES.has(source) ? source : "cockpit";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const allToolCalls: Array<{ name: string; args: any; result: any }> = [];
      let iter = 0;
      let finalReply = "";
      let maxIterReached = false;

      try {
        while (iter < MAX_TOOL_ITER) {
          iter++;
          // Non-streaming probe: did Gemini return tool_calls or final content?
          const probe = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
          if (!probe.ok) {
            const txt = await probe.text();
            sse(controller, { type: "error", code: probe.status, message: txt.slice(0, 300) });
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          const probeData = await probe.json();
          const message = probeData.choices?.[0]?.message;
          const toolCalls = message?.tool_calls;

          if (!toolCalls || toolCalls.length === 0 || !toolCtx) {
            // Final turn — re-issue WITH stream:true, pipe SSE through.
            const finalResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                max_tokens: 1500,
                messages: convo,
                stream: true,
              }),
            });
            if (!finalResp.ok || !finalResp.body) {
              // Fallback: use non-streamed content
              finalReply = message?.content ?? "Erreur de réponse de l'agent.";
              sse(controller, { type: "delta", content: finalReply });
            } else {
              const reader = finalResp.body.getReader();
              const decoder = new TextDecoder();
              let buf = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = buf.indexOf("\n")) !== -1) {
                  let line = buf.slice(0, nl);
                  buf = buf.slice(nl + 1);
                  if (line.endsWith("\r")) line = line.slice(0, -1);
                  if (!line.startsWith("data: ")) continue;
                  const j = line.slice(6).trim();
                  if (j === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(j);
                    const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
                    if (delta) {
                      finalReply += delta;
                      sse(controller, { type: "delta", content: delta });
                    }
                  } catch { buf = line + "\n" + buf; break; }
                }
              }
            }
            convo.push({ role: "assistant", content: finalReply });
            break;
          }

          // Tool-calling turn — push assistant + execute tools.
          convo.push({ role: "assistant", content: message.content ?? "", tool_calls: toolCalls });

          const reads: any[] = [];
          const writes: any[] = [];
          for (const tc of toolCalls) {
            const name = tc.function?.name as ToolName;
            if (READ_TOOLS.has(name)) reads.push(tc);
            else writes.push(tc);
          }

          const execOne = async (tc: any) => {
            const name = tc.function?.name as ToolName;
            sse(controller, { type: "tool_call_start", tool: name });
            let args: any = {};
            try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* keep empty */ }
            const handler = TOOL_HANDLERS[name];
            let result: any;
            if (!handler) result = { ok: false, error: `unknown tool: ${name}` };
            else {
              try { result = await handler(toolCtx!, args); }
              catch (e) { result = { ok: false, error: e instanceof Error ? e.message : "tool exception" }; }
            }
            sse(controller, { type: "tool_call_end", tool: name, ok: !!result?.ok });
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

        // MAX_ITER wrap-up
        if (iter >= MAX_TOOL_ITER && !finalReply) {
          maxIterReached = true;
          await supabase.from("system_failures").insert({
            failure_type: "execution",
            severity: "medium",
            message: "agent-converse: MAX_TOOL_ITER reached",
            campaign_id,
            reason: JSON.stringify({
              error_code: "agent_max_iter_reached",
              attempt_n: iter,
              tool_call_count: allToolCalls.length,
              tools_used: allToolCalls.map((t) => t.name),
              timestamp_iso: new Date().toISOString(),
            }),
          });
          const wrap = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              max_tokens: 800,
              messages: [...convo, { role: "user", content: "Limite d'outils atteinte. Synthétise sans tools." }],
              stream: true,
            }),
          });
          if (wrap.ok && wrap.body) {
            const reader = wrap.body.getReader();
            const decoder = new TextDecoder();
            let buf = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              let nl: number;
              while ((nl = buf.indexOf("\n")) !== -1) {
                let line = buf.slice(0, nl);
                buf = buf.slice(nl + 1);
                if (line.endsWith("\r")) line = line.slice(0, -1);
                if (!line.startsWith("data: ")) continue;
                const j = line.slice(6).trim();
                if (j === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(j);
                  const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
                  if (delta) { finalReply += delta; sse(controller, { type: "delta", content: delta }); }
                } catch { buf = line + "\n" + buf; break; }
              }
            }
          }
          if (!finalReply) finalReply = "Limite d'analyse atteinte.";
        }

        // Persist agent_messages + audit timeline (post-stream)
        if (resolvedUserId) {
          const { data: convRow } = await supabase
            .from("agent_conversations")
            .upsert(
              {
                campaign_id, user_id: resolvedUserId,
                context_snapshot: { ...dealContext, tool_calls_made: allToolCalls.length, max_iter_reached: maxIterReached },
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                surface,
              },
              { onConflict: "campaign_id,user_id", ignoreDuplicates: false },
            )
            .select("id").maybeSingle();

          const conversation_id = convRow?.id;
          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          if (conversation_id && lastUser) {
            await supabase.from("agent_messages").insert([
              { conversation_id, role: "user", content: lastUser.content, surface, metadata: {} },
              {
                conversation_id, role: "assistant", content: finalReply, surface,
                tool_calls: allToolCalls.length > 0 ? allToolCalls.map((t) => ({ name: t.name, args: t.args })) : null,
                tool_results: allToolCalls.length > 0 ? allToolCalls.map((t) => ({ name: t.name, ok: t.result?.ok })) : null,
                metadata: { iter, max_iter_reached: maxIterReached, internal_caller: trustedInternalCaller, source: source ?? null, streamed: true },
              },
            ]);
          }

          await writeTimelineEvent(supabase, "agent-converse", {
            campaign_id, org_id: campaign.org_id,
            event_type: "agent_message", event_layer: "fact",
            actor_user_id: resolvedUserId,
            event_data: {
              source: source ?? "direct", surface,
              tool_calls: allToolCalls.length, max_iter_reached: maxIterReached,
              tools_used: allToolCalls.map((t) => t.name),
              internal_caller: trustedInternalCaller, streamed: true,
            },
          });
        }

        // Final summary event for clients that need totals
        sse(controller, {
          type: "done",
          tool_calls: allToolCalls.length,
          max_iter_reached: maxIterReached,
          context: { des: dealContext.des, viewer_count: dealContext.viewer_count, momentum: dealContext.momentum },
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream error";
        console.error("agent-converse stream:", msg);
        sse(controller, { type: "error", message: msg });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
