// Phase 1d.5e GC-18 — Templates de relance contextuels (FR, B2B exécutif, "vous")
// Sélection client-side selon contexte (silence, accélération, multi-thread, etc.)
// Pas d'IA : library statique versionnée. AE personnalise après copy.

export type TemplateContext =
  | "silent_14d"
  | "silent_7d"
  | "accelerating"
  | "new_signal"
  | "multi_thread"
  | "blocker_detected"
  | "stage_gap"
  | "default";

export interface RelanceTemplate {
  id: string;
  context: TemplateContext;
  label: string;
  body: string;
}

export const RELANCE_TEMPLATES: RelanceTemplate[] = [
  {
    id: "silent_14d_check_in",
    context: "silent_14d",
    label: "Reprise après 2 semaines de silence",
    body:
      "Bonjour {{prenom}},\n\nJe reviens vers vous : pas de nouvelle depuis quelques temps sur le sujet {{deal}}. " +
      "Est-ce que la priorité a bougé de votre côté, ou est-ce qu'on peut caler un point court (15 min) cette semaine pour faire le point ?\n\nMerci par avance.",
  },
  {
    id: "silent_7d_lighter",
    context: "silent_7d",
    label: "Relance légère après 1 semaine",
    body:
      "Bonjour {{prenom}},\n\nJuste un message rapide pour savoir où vous en êtes sur {{deal}}. " +
      "Y a-t-il un élément qui vous manque pour avancer côté décision ?",
  },
  {
    id: "accelerating_capitalize",
    context: "accelerating",
    label: "Capitaliser sur l'accélération",
    body:
      "Bonjour {{prenom}},\n\nVu que les choses s'accélèrent sur {{deal}}, je vous propose de bloquer un créneau " +
      "cette semaine pour clarifier les prochaines étapes côté décision et éviter de perdre le momentum.",
  },
  {
    id: "new_signal_react",
    context: "new_signal",
    label: "Réagir à un signal récent",
    body:
      "Bonjour {{prenom}},\n\nJ'ai vu que la page du deal a été consultée à nouveau récemment. " +
      "Est-ce qu'il y a un point précis sur lequel vous souhaitez qu'on revienne ?",
  },
  {
    id: "multi_thread_sponsor",
    context: "multi_thread",
    label: "Engager un sponsor identifié",
    body:
      "Bonjour {{prenom}},\n\nJe vois que plusieurs personnes de votre côté ont parcouru les éléments du deal. " +
      "Pour qu'on avance proprement, est-ce qu'on peut caler un échange à 3 avec {{contact}} ?",
  },
  {
    id: "blocker_detected_clarify",
    context: "blocker_detected",
    label: "Clarifier un point bloquant",
    body:
      "Bonjour {{prenom}},\n\nJ'aimerais m'assurer qu'on lève le point qui vous fait hésiter. " +
      "Pouvez-vous me dire ce qui, en l'état, vous empêche de prioriser {{deal}} ?",
  },
  {
    id: "stage_gap_realign",
    context: "stage_gap",
    label: "Réaligner stage CRM vs réalité",
    body:
      "Bonjour {{prenom}},\n\nPour caler nos prévisions correctement, j'aimerais valider avec vous où vous en êtes vraiment " +
      "sur {{deal}} : phase d'évaluation, validation interne, ou en attente d'arbitrage ?",
  },
  {
    id: "default_check_in",
    context: "default",
    label: "Point d'avancement neutre",
    body:
      "Bonjour {{prenom}},\n\nJe reviens vers vous pour faire un point sur {{deal}}. " +
      "Avez-vous des éléments à partager ou souhaitez-vous qu'on cale un échange court ?",
  },
];

export function pickTemplatesForContext(ctx: {
  daysSinceLastSignal?: number | null;
  trajectory?: string | null;
  hasBlocker?: boolean;
  newSignalRecent?: boolean;
  multiThread?: boolean;
  stageGap?: boolean;
}): RelanceTemplate[] {
  const out: RelanceTemplate[] = [];
  const seen = new Set<TemplateContext>();
  const push = (c: TemplateContext) => {
    if (seen.has(c)) return;
    seen.add(c);
    out.push(...RELANCE_TEMPLATES.filter((t) => t.context === c));
  };
  if (ctx.hasBlocker) push("blocker_detected");
  if (ctx.stageGap) push("stage_gap");
  if (ctx.multiThread) push("multi_thread");
  if (ctx.newSignalRecent) push("new_signal");
  if (ctx.trajectory === "accelerating" || ctx.trajectory === "rising") push("accelerating");
  if ((ctx.daysSinceLastSignal ?? 0) >= 14) push("silent_14d");
  else if ((ctx.daysSinceLastSignal ?? 0) >= 7) push("silent_7d");
  push("default");
  return out;
}

export function fillTemplate(
  body: string,
  vars: { prenom?: string; deal?: string; contact?: string },
): string {
  return body
    .replace(/\{\{prenom\}\}/g, vars.prenom || "")
    .replace(/\{\{deal\}\}/g, vars.deal || "ce dossier")
    .replace(/\{\{contact\}\}/g, vars.contact || "votre interlocuteur");
}
