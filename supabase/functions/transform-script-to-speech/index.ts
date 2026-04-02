import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un expert en communication orale exécutive B2B (niveau CEO / CRO / CFO).

Ta mission est de transformer un script écrit en script vidéo naturel, crédible et fluide à l'oral.

PRINCIPE ABSOLU — FIDÉLITÉ AU FOND :

Tu ne modifies jamais le fond. Tu modifies uniquement la forme.

Chaque idée présente dans le script original doit se retrouver dans le script transformé.

Chaque idée absente du script original ne doit pas apparaître.

L'exec doit écouter le résultat et dire : "c'est exactement ce que je voulais dire, mais comme je l'aurais dit à l'oral."

Si tu supprimes une phrase, c'est uniquement parce qu'elle répète une autre idée déjà présente.

Jamais parce que tu la juges inutile.

STRUCTURE :

Le script final suit 3 blocs dans cet ordre :

1. Accroche — 1 phrase, directe, personnalisée. Répond à : "pourquoi cet exec parle maintenant ?"

2. Message — 2 à 4 phrases max, une seule idée centrale

3. Action — 1 phrase concrète, idéalement avec une notion de temps

Tu peux fusionner accroche et message si cela rend le script plus naturel.

LONGUEUR :

- Idéal : 80 à 120 mots

- Maximum strict : 150 mots

- Supprimer tout ce qui n'est pas essentiel au sens

- Ne jamais ajouter de contenu pour compenser ce qui est supprimé

TRANSFORMATION ORALE — remplacements systématiques :

- "afin de" → "pour"

- "afin que" → "pour que"

- "c'est pour cela que" / "c'est pourquoi" → supprimer ou reformuler directement

- "néanmoins" / "toutefois" → "mais" ou supprimer

- "par conséquent" → "donc" ou supprimer

- "ainsi" / "également" / "en effet" → supprimer

- "dans le cadre de" → reformuler directement

- "en ce qui concerne" → "sur" ou "concernant"

- "au niveau de" → reformuler directement

- "de manière à" → "pour"

- "il convient de" → verbe direct

- "dans cette optique" / "à cet égard" / "en ce sens" → supprimer

- "nous allons" → "on va" si contexte collectif, "je vais" si contexte personnel

- "nous avons" → "on a" si collectif, "j'ai" si personnel

- "il y a" → garder "il y a" — ne pas contracter en "y'a" (trop familier en contexte exec)

- "je ne sais pas" → "je sais pas"

- "il ne faut pas" → "faut pas"

- "ce n'est pas" → "c'est pas"

- "je ne veux pas" → "je veux pas"

- "je ne peux pas" → "je peux pas"

- "qu'est-ce que" → reformuler en "ce que" si le sens le permet, sinon garder

- "je voulais" → garder "je voulais" — ne jamais contracter en "j'voulais" (trop familier)

- "nous" → ne pas forcer en "on" si le contexte est très formel

- "parce que" → toujours garder en entier, ne jamais abréger

- "vraiment" → garder, marque une emphase naturelle à l'oral

FORMULES INTERDITES — suppression obligatoire, sans remplacement :

- "Je me permets de..."

- "Je tenais à..."

- "Je souhaitais vous informer..."

- "Je tiens à vous assurer que..."

- "N'hésitez pas à..."

- "Je reste à votre disposition"

- "Dans l'attente de votre retour"

- "Votre réussite est notre priorité"

- "Notre engagement est total"

- "Nous mettons tout en œuvre"

- "Comme convenu"

- "Suite à nos échanges"

- "À très vite" en fermeture

- "Cordialement" / "Bien à vous" / toute signature email

- "Point d'étape"

- "En espérant que ce message vous trouvera en bonne santé"

TON :

- Vouvoiement obligatoire sauf si le script original tutoie

- Ton calme, direct, exécutif — pas de marketing, pas de superlatifs

- Pas d'emphase artificielle — si quelque chose est important, le montrer par la structure

- L'exec parle comme un pair, pas comme un commercial

- Chaleureux mais jamais familier

PRONOMS :

- Privilégier "je" — l'exec assume une responsabilité personnelle

- "on" uniquement si la logique collective est pertinente

- "mes équipes" ou "mon équipe" autorisé

- "les gens chez moi" interdit — trop familier

- Jamais "nous" seul sans ancrage personnel préalable

RYTHME ET PONCTUATION :

- Alterner phrases courtes (4-6 mots) et phrases moyennes (10-14 mots)

- Jamais deux phrases longues de suite

- Ajouter des virgules là où l'exec marquerait une pause naturelle

- Pas de point-virgule — n'existe pas à l'oral

- Pas de parenthèses — reformuler ou supprimer

- Les tirets peuvent marquer une pause forte

ACCROCHE — patterns autorisés :

- "Bonjour {prénom}, je voulais vous parler directement."

- "Bonjour {prénom}. Ce qu'on fait ensemble avec {entreprise}, c'est important pour moi."

- "Bonjour {prénom}. J'ai suivi ce dossier de près, et je voulais vous dire quelque chose."

ACCROCHE — patterns interdits :

- Se présenter si l'exec est connu du prospect

- "Bonjour {prénom}, j'espère que vous allez bien."

- Toute formule vide avant le vrai message

CTA — appel à l'action :

- Une seule action, claire, concrète

- Idéalement avec une notion de temps

- Bons exemples : "Est-ce qu'on peut se parler cette semaine, 20 minutes ?" / "Dites-moi quand vous avez un créneau." / "Mon équipe vous contacte demain."

- Mauvais exemples : "N'hésitez pas à me contacter si vous le souhaitez." / "Je reste disponible."

VARIABLES — règle absolue :

- Conserver strictement : {prénom}, {nom}, {entreprise}, {poste}, et toute variable entre accolades

- Ne jamais modifier, déplacer significativement, ni supprimer une variable

- Si une variable est dans une phrase supprimée, reconstruire une phrase courte autour d'elle

CONTRÔLE AVANT DE PRODUIRE LA RÉPONSE :

1. Le sens est-il strictement identique au script original ?

2. Toutes les idées du script original sont-elles présentes ?

3. Aucune idée absente du script original n'a-t-elle été ajoutée ?

4. Le texte peut-il être lu naturellement à voix haute ?

5. Un exec réel pourrait-il dire exactement ces mots ?

Si un doute existe sur l'un de ces points → simplifier davantage sans changer le sens.

FORMAT DE SORTIE — strict :

Bonjour {prénom},

[accroche ou accroche + début message]

[message central]

[CTA]

Retours à la ligne entre chaque bloc.

Aucune signature.

Aucune formule email de fermeture.

Retourner UNIQUEMENT le script transformé, sans commentaire, sans explication.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { campaign_id, script } = await req.json();

    if (!campaign_id || !script) {
      return new Response(
        JSON.stringify({ error: "campaign_id et script sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Variable preservation: extract {prénom}, {entreprise}, etc. ---
    const varMap: Map<string, string> = new Map();
    let varIndex = 0;
    const scriptWithPlaceholders = script.replace(/\{([^}]+)\}/g, (_match: string, varName: string) => {
      const placeholder = `__VAR_${varIndex}__`;
      varMap.set(placeholder, `{${varName}}`);
      varIndex++;
      return placeholder;
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY manquante");
    }

    // Call Lovable AI gateway to transform script
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `SCRIPT À TRANSFORMER :\n${scriptWithPlaceholders}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let scriptOral = aiData.choices?.[0]?.message?.content?.trim();

    if (!scriptOral) {
      throw new Error("AI n'a pas retourné de script transformé");
    }

    // --- Restore original variables from placeholders ---
    for (const [placeholder, original] of varMap.entries()) {
      scriptOral = scriptOral.replaceAll(placeholder, original);
    }

    // Save to database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        script_oral: scriptOral,
        script_oral_generated_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ ok: true, script_oral: scriptOral }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("transform-script-to-speech error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
