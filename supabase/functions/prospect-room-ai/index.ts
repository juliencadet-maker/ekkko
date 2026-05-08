// Phase 1d.5c — prospect-room-ai
// Two modes:
//   - "summarize" : 3-5 bullets résumant la page (cap 1/h/campaign)
//   - "qa"        : réponse à une question prospect ancrée sur les contenus visibles
//                   (cap 5/24h par viewer_hash OU prospect_email)
//
// KNOWLEDGE ISOLÉ (prospect-side) :
//   ✅ deal_assets (asset_purpose, block_title, block_description) — visibles dans la page
//   ✅ campaigns.metadata.prospect_message + summary_bullets
//   ✅ campaigns.company_display_name
//   ❌ Aucun accès : agent_context, scores, contradictions, contacts, signaux, triggers, viewers
//
// WORDING VALIDATOR strict (zéro "IA", "intelligence artificielle", "campagne",
// "silencieux", "analyse") — termes interdits scrubbés ou réponse refusée.
//
// DISCLOSURE : la réponse renvoie toujours `disclosure` côté client.
//
// Capture Q&A : prospect_room_questions (service_role insert).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL = "google/gemini-3-flash-preview";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DISCLOSURE = "Réponse générée à partir des contenus de cette page.";
const UI_LABEL_QA = "Assistant de la page";
const UI_LABEL_SUMMARY = "Synthèse rapide";

// Forbidden tokens (regex, case-insensitive, accent-tolerant for the most common ones).
const FORBIDDEN = [
  /\bI\.?A\.?\b/gi,
  /\bintelligences?\s+artificielles?\b/gi,
  /\bintelligence\s+artificielle\b/gi,
  /\bcampagnes?\b/gi,
  /\bsilencieux(?:se|ses)?\b/gi,
  /\banalyses?\b/gi,
  /\banalyser\b/gi,
];

function scrubForbidden(text: string): { text: string; hits: number } {
  let hits = 0;
  let out = text;
  for (const re of FORBIDDEN) {
    out = out.replace(re, (m) => {
      hits++;
      // Soft replacements
      if (/campagne/i.test(m)) return "deal";
      if (/silencieux/i.test(m)) return "sans nouvelle";
      if (/analyse|analyser/i.test(m)) return "synthèse";
      // IA / intelligence artificielle → strip
      return "";
    });
  }
  // Collapse double spaces left by stripping
  out = out.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1");
  return { text: out.trim(), hits };
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI gateway not configured" }, 500);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid body" }, 400);

    const mode = body.mode;
    const campaign_id = body.campaign_id;
    if (!campaign_id || typeof campaign_id !== "string" || !UUID.test(campaign_id)) {
      return json({ error: "Valid campaign_id required" }, 400);
    }
    if (mode !== "summarize" && mode !== "qa") {
      return json({ error: "mode must be 'summarize' or 'qa'" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load isolated knowledge.
    const [campRes, assetsRes] = await Promise.all([
      admin.from("campaigns")
        .select("id, org_id, company_display_name, metadata")
        .eq("id", campaign_id).maybeSingle(),
      admin.from("deal_assets")
        .select("id, asset_type, asset_purpose, block_group, block_title, block_description, display_order")
        .eq("campaign_id", campaign_id)
        .eq("asset_status", "active")
        .is("deleted_at", null)
        .order("display_order", { ascending: true }),
    ]);

    if (campRes.error || !campRes.data) return json({ error: "Campaign not found" }, 404);
    const campaign = campRes.data;
    const meta = (campaign.metadata as Record<string, unknown>) || {};
    const prospect_message = ((meta.prospect_message as string) || "").trim();
    const summary_bullets = Array.isArray(meta.summary_bullets) ? (meta.summary_bullets as string[]) : [];
    const assets = assetsRes.data || [];

    const knowledge = {
      company_display_name: campaign.company_display_name || null,
      prospect_message: prospect_message || null,
      summary_bullets: summary_bullets.filter((b) => typeof b === "string" && b.trim()).slice(0, 5),
      blocks: assets.map((a: any) => ({
        kind: a.asset_purpose,
        type: a.asset_type,
        title: a.block_title || null,
        description: a.block_description || null,
      })),
    };

    if (mode === "summarize") {
      // Rate limit: 1 / campaign / hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("prospect_room_questions")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign_id)
        .gte("captured_at", oneHourAgo)
        .contains("metadata", { kind: "summary" });
      if ((count ?? 0) >= 1) {
        return json({ error: "RATE_LIMIT_SUMMARY_HOURLY" }, 429);
      }

      const sysPrompt = [
        "Tu rédiges une synthèse courte (3 à 5 puces) destinée à un prospect B2B,",
        "à partir UNIQUEMENT des contenus listés ci-dessous (titres et descriptions des blocs visibles).",
        "Ton: factuel, professionnel, concis. Pas de superlatifs, pas de promesses.",
        "INTERDIT (ne JAMAIS écrire) : 'IA', 'intelligence artificielle', 'campagne', 'silencieux', 'analyse'.",
        "N'invente aucun chiffre, aucune date, aucun nom. Si l'info n'est pas dans le contexte, ne la mentionne pas.",
        "Format de sortie : 3 à 5 puces commençant chacune par '- '. Aucun préambule, aucune conclusion.",
      ].join(" ");

      const userPrompt = `Contexte (JSON) :\n${JSON.stringify(knowledge, null, 2)}`;

      const aiResp = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (aiResp.status === 429) return json({ error: "AI_RATE_LIMIT" }, 429);
      if (aiResp.status === 402) return json({ error: "AI_PAYMENT_REQUIRED" }, 402);
      if (!aiResp.ok) {
        console.error("[prospect-room-ai] AI error", aiResp.status, await aiResp.text());
        return json({ error: "AI gateway error" }, 502);
      }
      const aiJson = await aiResp.json();
      const raw = aiJson.choices?.[0]?.message?.content?.trim() || "";
      const { text: cleaned, hits } = scrubForbidden(raw);

      // Persist as a soft trace (used for rate limiting + audit).
      await admin.from("prospect_room_questions").insert({
        campaign_id,
        org_id: campaign.org_id,
        question: "[résumé page]",
        generated_answer: cleaned,
        ae_status: "new",
        metadata: { kind: "summary", forbidden_hits: hits, model: MODEL },
      });

      return json({
        mode: "summarize",
        ui_label: UI_LABEL_SUMMARY,
        disclosure: DISCLOSURE,
        bullets: cleaned.split("\n").map((l) => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean).slice(0, 5),
      });
    }

    // ============ QA mode ============
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) return json({ error: "question required" }, 400);
    if (question.length > 1000) return json({ error: "question too long" }, 400);

    const viewer_hash = typeof body.viewer_hash === "string" ? body.viewer_hash.slice(0, 128) : null;
    const prospect_email = typeof body.prospect_email === "string"
      ? body.prospect_email.trim().toLowerCase().slice(0, 255) : null;
    const prospect_display_name = typeof body.prospect_display_name === "string"
      ? body.prospect_display_name.trim().slice(0, 200) : null;
    const asset_in_focus_id = typeof body.asset_in_focus_id === "string" && UUID.test(body.asset_in_focus_id)
      ? body.asset_in_focus_id : null;

    if (!viewer_hash && !prospect_email) {
      return json({ error: "viewer_hash or prospect_email required" }, 400);
    }

    // Rate limit: 5 / viewer / 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let q = admin
      .from("prospect_room_questions")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .gte("captured_at", dayAgo)
      .contains("metadata", { kind: "qa" });
    if (viewer_hash) {
      q = q.contains("metadata", { viewer_hash });
    } else {
      q = q.eq("prospect_email", prospect_email!);
    }
    const { count: qaCount } = await q;
    if ((qaCount ?? 0) >= 5) {
      return json({ error: "RATE_LIMIT_QA_24H" }, 429);
    }

    // org_id already loaded from campaigns above.

    const sysPrompt = [
      "Tu es un assistant qui répond aux questions d'un prospect à partir UNIQUEMENT du contexte JSON fourni.",
      "Si la réponse n'est pas dans le contexte, dis-le honnêtement et propose au prospect d'en parler avec son interlocuteur.",
      "Ton: factuel, courtois, concis (≤ 4 phrases).",
      "INTERDIT (ne JAMAIS écrire) : 'IA', 'intelligence artificielle', 'campagne', 'silencieux', 'analyse'.",
      "N'invente aucun chiffre, aucune date, aucun nom propre absent du contexte.",
      "N'évoque jamais de scoring, signaux, contacts internes, ni de mécanismes d'analyse.",
    ].join(" ");

    const userPrompt = [
      `Question : ${question}`,
      `Contexte (JSON, blocs visibles dans la page) :`,
      JSON.stringify(knowledge, null, 2),
    ].join("\n");

    const aiResp = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (aiResp.status === 429) return json({ error: "AI_RATE_LIMIT" }, 429);
    if (aiResp.status === 402) return json({ error: "AI_PAYMENT_REQUIRED" }, 402);
    if (!aiResp.ok) {
      console.error("[prospect-room-ai] AI error", aiResp.status, await aiResp.text());
      return json({ error: "AI gateway error" }, 502);
    }
    const aiJson = await aiResp.json();
    const raw = aiJson.choices?.[0]?.message?.content?.trim() || "";
    const { text: cleaned, hits } = scrubForbidden(raw);

    const { data: inserted, error: insErr } = await admin
      .from("prospect_room_questions")
      .insert({
        campaign_id,
        org_id: campaign.org_id,
        asset_in_focus_id,
        prospect_email,
        prospect_display_name,
        question,
        generated_answer: cleaned,
        ae_status: "new",
        metadata: {
          kind: "qa",
          viewer_hash,
          forbidden_hits: hits,
          model: MODEL,
        },
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[prospect-room-ai] capture failed", insErr);
      // Still return the answer to the prospect — capture is best-effort.
    }

    return json({
      mode: "qa",
      ui_label: UI_LABEL_QA,
      disclosure: DISCLOSURE,
      answer: cleaned,
      question_id: inserted?.id ?? null,
    });
  } catch (e) {
    console.error("[prospect-room-ai] error", e);
    return json({ error: "Internal error" }, 500);
  }
});
