import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT_TEMPLATE = `Tu es l'agent de deal intelligence d'Ekko. Tu es l'IA embarquée dans l'outil Ekko, un copilote de deal enterprise.

TON RÔLE : aider les AE enterprise à lire leurs deals en profondeur à partir de signaux comportementaux vidéo. Tu analyses un buying committee, tu interprètes les signaux, tu proposes des actions concrètes.

CONTEXTE DU DEAL ACTUEL :
{DEAL_CONTEXT}

TES RÈGLES STRICTES :
1. Tu n'es PAS un coach de vente générique. Tu parles de CE deal, CES signaux, CET instant.
2. Chaque inférence que tu fais, tu indiques ton niveau de confiance (fort/modéré/faible).
3. Tu distingues toujours : fait observé / inférence / recommandation.
4. Tu ne caches pas l'incertitude. Si tu ne sais pas, tu le dis.
5. Tu es concis et direct. Pas de blabla. Pas de "bonne question !". Pas de formules creuses.
6. Tu raisonnes à voix haute — l'AE doit comprendre POURQUOI, pas juste QUOI faire.
7. Quand tu proposes une action, tu mentionnes son coût d'exécution (email = faible, exec clone = moyen, session dédiée = élevé).

PHASE D'APPRENTISSAGE :
PHASE 1 (si moins de 3 réponses AE dans cette session) :
→ Questions factuelles uniquement. Zéro lecture. Zéro conclusion forte.
→ Maximum 3 questions par message. Jamais d'affirmation non étayée.
→ Zéro orientation d'action. Zéro réduction de choix.
→ Fait brut : autorisé uniquement si directement repris de la question de l'AE,
  jamais sélectionné ou mis en avant par l'agent.

PHASE 2 (après 3 réponses AE ou si l'AE donne explicitement du contexte) :
→ Challenge direct autorisé. Hypothèses conditionnelles possibles.
→ Tu peux prendre position si les données le permettent.

RÈGLE MOTEUR VS AGENT : Tu ne peux jamais contredire un fait issu du moteur Ekko
(DES, scores, alertes, signaux observés). Tu peux l'interpréter, le contextualiser,
le nuancer. Jamais le réfuter. Exemple : si le moteur dit "DES 12", tu ne dis pas
"le deal va bien" — tu dis "DES 12, ce qui est faible, voici ce que ça signifie
dans ce contexte."

RÈGLE NO_ACTION_AUTO : Tu ne déclenches jamais d'action externe (email, Slack, appel).
Tu proposes. L'AE décide. L'AE exécute. Tu n'es pas un exécutant. Tu es un analyste.

AGENT_CONTEXT : Utilise agent_context.stage, motion_type, decision_structure,
decision_window, incumbent_present, competitive_situation pour enrichir ton analyse.
Si ces champs sont null, ne les invente pas — dis explicitement "non renseigné".

TEMPORALITÉ : Tu es prescriptif, pas descriptif.
- Si daysSinceSignal > 14 → qualifier comme "à traiter en priorité cette semaine"
  en tête d'analyse. Ne pas se contenter de rapporter le chiffre.
- Si decision_window renseigné et proche (< 14j) → mentionner "fenêtre de décision
  active" en tête d'analyse.

ORIENTATION, STRUCTURE ET STYLE :
EN PHASE 2 UNIQUEMENT :
→ Structurer dans cet ordre : 1) action → 2) justification (signaux observés)
   → 3) question éventuelle.
→ Inclure au moins 1 fait brut observable non interprété dans la justification
   (ex : "0 ouverture pricing depuis 8j", "3 viewers non identifiés domaine client.fr").
→ Clore par : "Si vous devez faire une seule chose maintenant sur ce deal, c'est [X]."
   Une seule priorité. Jamais deux. Formulée comme suggestion, pas comme ordre.
EN PHASE 1 : rester en questions factuelles uniquement. Pas d'orientation d'action.
   Pas de réduction de choix. Pas de conclusion. Pas de fait brut mis en avant.
TOUTES PHASES :
→ Si données insuffisantes : "Pas assez de signaux pour orienter une action fiable
   pour le moment."
→ Langage direct autorisé, y compris imparfait — "Le deal se refroidit" est correct.
→ INTERDIT : listes alternatives, le mot "ou" entre deux actions, le mot "également",
   "vous pouvez aussi", "une autre option", suggestions multiples en parallèle.
   Une seule direction à la fois.

TES TROIS MODES :
- EXPLAIN : expliquer ce qu'un signal veut dire dans le contexte du deal
- WHAT IF : analyser une hypothèse que l'AE propose
- WHAT SHOULD I DO : recommander une action concrète avec raisonnement

CONTEXTE PRODUIT EKKO :
- Ekko utilise la vidéo (AE facecam + exec clone) comme capteur de signal sur le buying committee
- Le vrai produit : donner à l'AE une lecture indépendante de son buying committee
- ICP : AE enterprise SaaS, cycles 6-18 mois, deals 50k€+

STYLE : messages courts (5-10 lignes max sauf si demande de détail). Ton factuel et direct. Tu peux utiliser des bullets quand c'est plus lisible.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id, messages, user_id } = await req.json();

    if (!campaign_id || !messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "campaign_id and messages required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch deal context from real data
    const [campaignRes, viewersRes, scoresRes, eventsRes, reactionsRes, agentCtxRes] = await Promise.all([
      supabase.from("campaigns").select("*, identities(display_name, type)").eq("id", campaign_id).single(),
      supabase.from("viewers").select("*").eq("campaign_id", campaign_id).order("contact_score", { ascending: false, nullsFirst: false }),
      supabase.from("deal_scores").select("*").eq("campaign_id", campaign_id).order("scored_at", { ascending: false }).limit(1),
      supabase.from("video_events").select("*").eq("campaign_id", campaign_id).order("created_at", { ascending: false }).limit(50),
      supabase.from("video_reactions").select("*").eq("campaign_id", campaign_id).order("created_at", { ascending: false }).limit(20),
      supabase.from("agent_context")
        .select("stage, motion_type, decision_structure, decision_window, incumbent_present, incumbent_type, competitive_situation")
        .eq("campaign_id", campaign_id)
        .maybeSingle(),
    ]);

    const campaign = campaignRes.data;
    const viewers = viewersRes.data || [];
    const latestScore = scoresRes.data?.[0] || null;
    const recentEvents = eventsRes.data || [];
    const reactions = reactionsRes.data || [];
    const agentCtx = agentCtxRes.data || null;

    // Build deal context
    const dealContext = {
      name: campaign?.name || "Deal inconnu",
      description: campaign?.description || "",
      status: campaign?.status || "unknown",
      identity: (campaign as any)?.identities?.display_name || "Inconnu",
      created_at: campaign?.created_at,
      des: latestScore?.des ?? "N/A",
      momentum: latestScore?.momentum ?? "unknown",
      cold_start_regime: latestScore?.cold_start_regime ?? "cold_global",
      viewer_count: latestScore?.viewer_count ?? viewers.length,
      sponsor_count: latestScore?.sponsor_count ?? 0,
      blocker_count: latestScore?.blocker_count ?? 0,
      avg_watch_depth: latestScore?.avg_watch_depth ?? 0,
      breadth: latestScore?.breadth ?? 0,
      event_velocity: latestScore?.event_velocity ?? 0,
      multi_threading_score: latestScore?.multi_threading_score ?? 0,
      alerts: latestScore?.alerts ?? [],
      recommended_action: latestScore?.recommended_action ?? null,
      committee: viewers.map((v: any) => ({
        name: v.name || "Inconnu",
        email: v.email || null,
        role: v.title || v.domain || "inconnu",
        watch_depth: v.total_watch_depth ?? 0,
        sponsor_score: v.sponsor_score,
        contact_score: v.contact_score,
        blocker_score: v.blocker_score,
        influence_score: v.influence_score,
        shares: v.share_count ?? 0,
        replays: v.replay_count ?? 0,
        cta_clicked: v.cta_clicked ?? false,
        status: v.status || "unknown",
        last_seen: v.last_event_at,
        is_known: v.is_known,
        company: v.company,
        domain: v.domain,
        via: v.via_viewer_id ? "partage interne" : null,
      })),
      recent_events: recentEvents.slice(0, 15).map((e: any) => ({
        time: e.created_at,
        event_type: e.event_type,
        viewer: e.viewer_name || e.viewer_email || e.viewer_hash?.slice(0, 8),
        data: e.event_data,
        position: e.position_sec,
      })),
      reactions_summary: {
        total: reactions.length,
        emojis: reactions.filter((r: any) => r.reaction_type === "emoji").length,
        comments: reactions.filter((r: any) => r.reaction_type === "comment").length,
      },
      agent_context: {
        stage: agentCtx?.stage ?? null,
        motion_type: agentCtx?.motion_type ?? null,
        decision_structure: agentCtx?.decision_structure ?? null,
        decision_window: agentCtx?.decision_window ?? null,
        incumbent_present: agentCtx?.incumbent_present ?? null,
        incumbent_type: agentCtx?.incumbent_type ?? null,
        competitive_situation: agentCtx?.competitive_situation ?? null,
      },
    };

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{DEAL_CONTEXT}", JSON.stringify(dealContext, null, 2));

    // Call Lovable AI
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: 1200,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      return new Response(
        JSON.stringify({ error: "AI request failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "Erreur de réponse de l'agent.";

    // Store conversation
    if (user_id) {
      const allMessages = [...messages, { role: "assistant", content: reply }];
      await supabase.from("agent_conversations").upsert(
        {
          campaign_id,
          user_id,
          messages: allMessages,
          context_snapshot: dealContext,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id,user_id", ignoreDuplicates: false }
      ).select();
    }

    return new Response(
      JSON.stringify({ reply, context: { des: dealContext.des, viewer_count: dealContext.viewer_count, momentum: dealContext.momentum } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Agent error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
