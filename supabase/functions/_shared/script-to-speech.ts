// Phase 1c-2 — Module partagé : naturalisation script écrit → script oral.
// IMPORTANT — Duplication temporaire 30j ACCEPTÉE : V0 (transform-script-to-speech) NE LE CONSOMME PAS.
// V0 garde son SYSTEM_PROMPT inline byte-identical. V1.5 (transform-script-to-speech-v1) consomme ce module.
// TODO Phase 2 : convergence V0 → consommateur de ce module + kill du SYSTEM_PROMPT inline V0.

export const NATURALIZE_SYSTEM_PROMPT = `Tu es un expert en communication orale exécutive B2B (niveau CEO / CRO / CFO).

Ta mission est de transformer un script écrit en script vidéo naturel, crédible et fluide à l'oral.

PRINCIPE ABSOLU — FIDÉLITÉ AU FOND :
Tu ne modifies jamais le fond. Tu modifies uniquement la forme.
Chaque idée présente dans le script original doit se retrouver dans le script transformé.
Chaque idée absente du script original ne doit pas apparaître.

STRUCTURE : 3 blocs (Accroche / Message / Action).
LONGUEUR : 80-120 mots idéal, 150 max.
TON : Vouvoiement obligatoire, calme, direct, exécutif.
VARIABLES : Conserver strictement {prénom}, {nom}, {entreprise}, {poste}.

FORMULES INTERDITES (suppression sans remplacement) :
"Je me permets de...", "Je tenais à...", "N'hésitez pas à...", "Je reste à votre disposition",
"Dans l'attente de votre retour", "Cordialement", toute signature email.

FORMAT DE SORTIE — strict :
Bonjour {prénom},
[accroche]
[message central]
[CTA]

Retourner UNIQUEMENT le script transformé, sans commentaire.`;

export interface NaturalizeOptions {
  script: string;
  apiKey: string; // LOVABLE_API_KEY
  model?: string;
}

export interface NaturalizeResult {
  scriptOral: string;
  tokensIn?: number;
  tokensOut?: number;
}

/**
 * Pure function : transforms a written script into oral form via Lovable AI gateway.
 * No I/O DB. Throws on failure (caller handles retry/fallback/system_failures).
 */
export async function naturalizeScript(opts: NaturalizeOptions): Promise<NaturalizeResult> {
  const { script, apiKey } = opts;
  const model = opts.model ?? "google/gemini-3-flash-preview";

  // Variable preservation
  const varMap = new Map<string, string>();
  let i = 0;
  const scriptWithPlaceholders = script.replace(/\{([^}]+)\}/g, (_m, n) => {
    const ph = `__VAR_${i++}__`;
    varMap.set(ph, `{${n}}`);
    return ph;
  });

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: NATURALIZE_SYSTEM_PROMPT },
        { role: "user", content: `SCRIPT À TRANSFORMER :\n${scriptWithPlaceholders}` },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI_GATEWAY_${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  let scriptOral = data.choices?.[0]?.message?.content?.trim();
  if (!scriptOral) throw new Error("AI_EMPTY_RESPONSE");

  for (const [ph, original] of varMap.entries()) {
    scriptOral = scriptOral.replaceAll(ph, original);
  }

  return {
    scriptOral,
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  };
}
