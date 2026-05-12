import { useState, useEffect, useRef, FormEvent, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  Check, Loader2, Sparkles, Play,
  Network, PlayCircle, Wand2,
} from "lucide-react";

const CALENDLY_URL = "https://calendly.com/julien-cadet-getekko/discovery-call";
const IVORY = "#F7F6F3";
const MARINE = "#0D1B2A";
const GREEN = "#1AE08A";
const AMBER = "#E8A838";
const RED = "#E5484D";

type FormState = "idle" | "loading" | "success" | "error";
type Role = "" | "vp" | "ae" | "exec" | "other";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ================================================================
   INSIGHT TYPES & DATA
   ================================================================ */

type CTA = { label: string; variant: "filled" | "outline"; icon?: "play" };
type NBA = { n: string; title: string; lines: string[]; cta: CTA };
type Insight = {
  id: string;
  accent: string;
  eyebrow: string;
  titleLines: string[];
  readingLines: string[];
  nbas: NBA[];
};

const INSIGHTS: Insight[] = [
  {
    id: "brookfield",
    accent: GREEN,
    eyebrow: "NOUVEAU SIGNAL · IL Y A 4 MIN",
    titleLines: ["Sarah Levin (Brookfield Capital)", "a vu votre proposition"],
    readingLines: [
      "Fonds investisseur dans la boucle.",
      "Aucun contact côté fonds engagé.",
      "Trois leviers à activer.",
    ],
    nbas: [
      { n: "01", title: "Auditer le portefeuille du fonds", lines: ["Vos clients déjà détenus par Brookfield ?"], cta: { label: "Lancer", variant: "outline" } },
      { n: "02", title: "Activer un référent client portfolio", lines: ["Mise en relation client content, prospect"], cta: { label: "Identifier", variant: "outline" } },
      { n: "03", title: "Vérifier l'angle engagement cloud", lines: ["Crédit consommation à mobiliser ?"], cta: { label: "Vérifier", variant: "outline" } },
    ],
  },
  {
    id: "renard",
    accent: AMBER,
    eyebrow: "SIGNAL D'ALERTE · 14 JOURS SANS SIGNAL",
    titleLines: ["Sophie Renard (DSI) ne répond plus", "depuis le 28 avril"],
    readingLines: [
      "DRH et DAF très actifs cette semaine.",
      "Risque concentré sur la fonction technique.",
    ],
    nbas: [
      { n: "01", title: "Atelier sécurité dédié", lines: ["Session 1h avec votre architecte"], cta: { label: "Proposer", variant: "outline" } },
      { n: "02", title: "Engagement pair-to-pair de votre CTO", lines: ["Clone vocal · vidéo prête en 4 min"], cta: { label: "Envoyer la vidéo CTO", variant: "filled", icon: "play" } },
      { n: "03", title: "Relais via DRH ou DAF", lines: ["3-way informel"], cta: { label: "Demander", variant: "outline" } },
    ],
  },
  {
    id: "rfp",
    accent: GREEN,
    eyebrow: "FENÊTRE DE VISIBILITÉ · IL Y A 12 MIN",
    titleLines: ["3 contacts ont ouvert", "votre réponse RFP"],
    readingLines: [
      "Revue interne du comité en préparation.",
      "Courte fenêtre pour vous distinguer.",
    ],
    nbas: [
      { n: "01", title: "Renforcer votre réponse", lines: ["Addendum ciblé sur les zones d'ombre"], cta: { label: "Créer la Deal Room", variant: "outline" } },
      { n: "02", title: "Votre vidéo perso 2 min", lines: ["Votre lecture du contexte, en votre nom"], cta: { label: "Envoyer ma vidéo", variant: "filled", icon: "play" } },
      { n: "03", title: "Saisir la fenêtre 24h", lines: ["Atterrir avant la revue interne"], cta: { label: "Programmer", variant: "outline" } },
    ],
  },
];

/* ================================================================
   INSIGHT PANEL
   ================================================================ */

function InsightPanel({ insight }: { insight: Insight }) {
  const { accent, eyebrow, titleLines, readingLines, nbas } = insight;
  return (
    <motion.div
      key={insight.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
      transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
      className="absolute inset-0 p-6 md:p-7"
    >
      <div className="text-[11px] font-semibold uppercase mb-2.5" style={{ color: accent, letterSpacing: "0.18em" }}>
        {eyebrow}
      </div>
      <h3 className="text-[18px] md:text-[20px] font-bold leading-[1.3] mb-5" style={{ color: IVORY }}>
        {titleLines.map((l, i) => <span key={i} className="block">{l}</span>)}
      </h3>

      <div
        className="rounded-[12px] p-4 mb-5"
        style={{ background: "rgba(247,246,243,0.05)", borderLeft: `2px solid ${accent}` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: accent }} />
          <span className="text-[11px] font-semibold uppercase" style={{ color: accent, letterSpacing: "0.15em" }}>
            Lecture Ekko
          </span>
        </div>
        <div className="space-y-1">
          {readingLines.map((l, i) => (
            <p key={i} className="text-[13.5px] md:text-[14px] italic leading-[1.55]" style={{ color: "rgba(247,246,243,0.75)" }}>
              {l}
            </p>
          ))}
        </div>
      </div>

      <div className="text-[11px] font-semibold uppercase mb-3" style={{ color: "rgba(247,246,243,0.4)", letterSpacing: "0.18em" }}>
        Actions recommandées
      </div>
      <div className="flex flex-col gap-3.5">
        {nbas.map((nba) => {
          const showIcon = nba.cta.variant === "filled" && nba.cta.icon === "play";
          return (
            <div key={nba.n} className="flex gap-3">
              <div
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{ background: `${accent}26`, color: accent }}
              >
                {nba.n}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
                  <div className="text-[13.5px] md:text-[14px] font-bold leading-[1.3] flex-1 min-w-0" style={{ color: "rgba(247,246,243,0.92)" }}>
                    {nba.title}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-[6px] font-bold text-[11px] px-2.5 py-1.5 transition-all duration-200"
                    style={
                      nba.cta.variant === "filled"
                        ? { background: accent, color: MARINE }
                        : { background: "transparent", color: accent, border: `1px solid ${accent}` }
                    }
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.03)";
                      if (nba.cta.variant === "filled") e.currentTarget.style.filter = "brightness(1.05)";
                      else e.currentTarget.style.background = `${accent}1A`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "";
                      e.currentTarget.style.filter = "";
                      if (nba.cta.variant === "outline") e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {showIcon && <Play className="w-3 h-3" strokeWidth={2.5} />}
                    {nba.cta.label}
                  </button>
                </div>
                <ul className="space-y-0.5">
                  {nba.lines.map((l, i) => (
                    <li key={i} className="text-[12.5px] md:text-[13px] leading-[1.5] pl-3" style={{ color: "rgba(247,246,243,0.55)" }}>
                      <span style={{ color: `${accent}99` }}>→</span> {l}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ================================================================
   PRODUCT VISUAL — single AE deal carousel
   ================================================================ */

function ProductVisual() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % INSIGHTS.length), 12000);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.6, ease: "easeOut" }}
      className="mx-auto rounded-[28px] p-5 md:p-10"
      style={{
        background: MARINE,
        maxWidth: 1200,
        boxShadow: "0 50px 100px -30px rgba(13,27,42,0.30)",
      }}
    >
      {/* TOP BAR */}
      <div
        className="flex items-center justify-between pb-6 md:pb-7 flex-wrap gap-3"
        style={{ borderBottom: "1px solid rgba(247,246,243,0.08)" }}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="relative inline-flex w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full" style={{ background: GREEN, animation: "ekkoPulse 1.5s ease-in-out infinite" }} />
            <span className="relative inline-flex rounded-full w-2.5 h-2.5" style={{ background: GREEN }} />
          </span>
          <span className="text-[13px] md:text-[14px] font-bold" style={{ color: IVORY }}>
            Crédit Mutuel · 220k€
          </span>
          <span className="text-[12px]" style={{ color: "rgba(247,246,243,0.4)" }}>· AE : Marc</span>
        </div>
        <span className="text-[12px]" style={{ color: "rgba(247,246,243,0.5)" }}>
          Mardi 9h12 · live
        </span>
      </div>

      {/* DOTS */}
      <div className="flex justify-center gap-2 pt-5 pb-4">
        {INSIGHTS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Insight ${i + 1}`}
            className="rounded-[2px] transition-all duration-[600ms]"
            style={{
              width: i === idx ? 28 : 8,
              height: 4,
              background: i === idx ? GREEN : "rgba(247,246,243,0.2)",
            }}
          />
        ))}
      </div>

      {/* INSIGHT */}
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="relative rounded-[14px] overflow-hidden"
        style={{
          background: "rgba(247,246,243,0.03)",
          border: "1px solid rgba(247,246,243,0.08)",
          minHeight: 480,
        }}
      >
        <AnimatePresence mode="wait">
          <InsightPanel key={INSIGHTS[idx].id} insight={INSIGHTS[idx]} />
        </AnimatePresence>
      </div>

      {/* PIED */}
      <div className="mt-6 pt-6 text-center" style={{ borderTop: "1px solid rgba(247,246,243,0.08)" }}>
        <p className="text-[13px]" style={{ color: "rgba(247,246,243,0.55)" }}>
          Aussi : PowerMap live · booklet exec · atelier ROI · timing coach · suivi engagement
        </p>
      </div>
    </motion.div>
  );
}

/* ================================================================
   FORM
   ================================================================ */

const ROLE_OPTIONS: { value: Exclude<Role, "">; label: string; cta: string }[] = [
  { value: "vp", label: "VP Sales · CRO · Head of Sales", cta: "Réserver ma démo · 20 min" },
  { value: "ae", label: "Account Executive Senior", cta: "Rejoindre la liste pilote bêta" },
  { value: "exec", label: "Dirigeant", cta: "Recevoir la note Ekko" },
  { value: "other", label: "Autre", cta: "M'envoyer plus d'infos" },
];

function FormSection() {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [effectif, setEffectif] = useState("");
  const [role, setRole] = useState<Role>("");
  const [state, setState] = useState<FormState>("idle");
  const [errMsg, setErrMsg] = useState("");

  const ctaLabel = useMemo(() => {
    const found = ROLE_OPTIONS.find((r) => r.value === role);
    return found?.cta ?? "Sélectionnez votre rôle";
  }, [role]);

  const disabled = !role || state === "loading";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!role) return;
    setState("loading");
    setErrMsg("");
    try {
      const { error } = await supabase.functions.invoke("early-access-signup", {
        body: { prenom, nom, email, entreprise, effectif, role },
      });
      if (error) throw error;
      setState("success");
    } catch {
      setState("error");
      setErrMsg("Une erreur est survenue. Réessayez ou écrivez à julien@getekko.eu");
    }
  };

  return (
    <section
      id="form"
      className="px-5 py-20 md:py-32"
      style={{ background: `${GREEN}1A` }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4 }}
        className="mx-auto rounded-[24px] p-8 md:p-12 bg-white"
        style={{ maxWidth: 640, boxShadow: "0 20px 40px -10px rgba(13,27,42,0.08)" }}
      >
        {state === "success" ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: `${GREEN}33` }}>
              <Check className="w-7 h-7" style={{ color: GREEN }} strokeWidth={3} />
            </div>
            <h3 className="text-[24px] font-bold mb-2" style={{ color: MARINE }}>Reçu, je reviens sous 24h.</h3>
            <p className="text-[15px]" style={{ color: "rgba(13,27,42,0.65)" }}>
              Réponse à l'adresse {email}.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="text-[11px] font-semibold uppercase" style={{ color: GREEN, letterSpacing: "0.18em" }}>
              Rejoignez Ekko
            </div>
            <h3 className="text-[26px] md:text-[36px] font-bold leading-[1.05]" style={{ color: MARINE, letterSpacing: "-0.02em" }}>
              Une démo.<br />Une note.<br />Ou un pilote bêta.
            </h3>
            <p className="text-[15px] leading-[1.45]" style={{ color: "rgba(13,27,42,0.65)" }}>
              Selon votre rôle, le bon format.<br />Aucun engagement, aucun pitch.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <Field label="Prénom *" value={prenom} onChange={setPrenom} required />
              <Field label="Nom *" value={nom} onChange={setNom} required />
            </div>
            <Field label="Email pro *" value={email} onChange={setEmail} required type="email" />
            <Field label="Entreprise *" value={entreprise} onChange={setEntreprise} required />
            <Field label="Effectif équipe Sales (optionnel)" value={effectif} onChange={setEffectif} />

            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "rgba(13,27,42,0.7)" }}>
                Votre rôle *
              </label>
              <select
                required
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-[10px] px-4 py-3 text-[14px] outline-none transition-colors"
                style={{
                  background: "rgba(13,27,42,0.04)",
                  color: MARINE,
                  border: "1px solid rgba(13,27,42,0.1)",
                }}
              >
                <option value="" disabled>Choisissez votre rôle…</option>
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {state === "error" && (
              <p className="text-[13px]" style={{ color: RED }}>{errMsg}</p>
            )}

            <button
              type="submit"
              disabled={disabled}
              className="w-full rounded-[10px] font-bold text-[15px] transition-all duration-300"
              style={{
                height: 56,
                background: disabled ? "rgba(13,27,42,0.12)" : GREEN,
                color: disabled ? "rgba(13,27,42,0.45)" : MARINE,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {state === "loading" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Envoi…
                </span>
              ) : ctaLabel}
            </button>

            <p className="text-center text-[12px]" style={{ color: "rgba(13,27,42,0.5)" }}>
              Pas de spam. Réponse sous 24h.
            </p>
          </form>
        )}
      </motion.div>
    </section>
  );
}

function Field({
  label, value, onChange, required, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "rgba(13,27,42,0.7)" }}>
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] px-4 py-3 text-[14px] outline-none transition-colors"
        style={{
          background: "rgba(13,27,42,0.04)",
          color: MARINE,
          border: "1px solid rgba(13,27,42,0.1)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = GREEN)}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(13,27,42,0.1)")}
      />
    </div>
  );
}

/* ================================================================
   SECTIONS
   ================================================================ */

function Eyebrow({ children, color = GREEN }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-block text-[12px] font-semibold uppercase"
      style={{ color, letterSpacing: "0.18em" }}
    >
      {children}
    </span>
  );
}

function ConstatSection() {
  const lines = [
    "Vos top ont des automatismes.",
    "Vos AE moyens ne les ont pas.",
    "Pas du talent. De la mécanique.",
  ];
  return (
    <section className="px-5 py-20 md:py-40" style={{ background: MARINE }}>
      <div className="mx-auto text-center" style={{ maxWidth: 900 }}>
        <Eyebrow>La réalité d'une équipe Sales</Eyebrow>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="font-bold mt-8 mb-6"
          style={{ color: IVORY, fontSize: "clamp(32px, 6vw, 64px)", lineHeight: 1, letterSpacing: "-0.025em" }}
        >
          20% de vos AE font<br />80% du chiffre.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="font-bold"
          style={{ color: "rgba(247,246,243,0.7)", fontSize: "clamp(22px, 2.5vw, 28px)" }}
        >
          Vous le savez. Eux aussi.
        </motion.p>
        <div className="flex flex-col gap-7 mt-20 mb-24">
          {lines.map((l, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.2 }}
              className="leading-[1.4]"
              style={{ color: "rgba(247,246,243,0.8)", fontSize: "clamp(17px, 1.8vw, 22px)" }}
            >
              {l}
            </motion.p>
          ))}
        </div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-bold mx-auto leading-[1.2]"
          style={{ color: IVORY, fontSize: "clamp(22px, 3vw, 32px)", maxWidth: 720 }}
        >
          Et si chaque AE<br />avait ces automatismes<br />dans sa poche ?
        </motion.p>
      </div>
    </section>
  );
}

function LeviersSection() {
  const cards = [
    {
      tag: "01 · COACHING",
      Icon: Sparkles,
      title: "Le bon move.\nSur chaque deal.",
      body: "Lecture du contexte. 3 actions exécutables. Vos AE arrivent armés en deal review.",
    },
    {
      tag: "02 · POWERMAP",
      Icon: Network,
      title: "Voyez ce qui bouge\nquand vous n'êtes pas là.",
      body: "Qui regarde. Qui forward. Qui réagit. La carte du comité, en temps réel.",
    },
    {
      tag: "03 · VIDÉO EXEC",
      Icon: PlayCircle,
      title: "Votre voix.\nSur chaque deal.",
      body: "Validation 1 clic. Clone vocal. Présence exec sur 100% des deals.",
    },
    {
      tag: "04 · ASSETS",
      Icon: Wand2,
      title: "Vidéo, booklet, atelier ROI.\nEn 5 minutes.",
      body: "L'AE parle 30 secondes. Ekko produit. Le travail des top, accessible à tous.",
    },
  ];
  return (
    <section className="px-5 py-20 md:py-36" style={{ background: IVORY }}>
      <div className="mx-auto text-center mb-16" style={{ maxWidth: 1100 }}>
        <Eyebrow>Ce qu'Ekko orchestre</Eyebrow>
        <h2 className="font-bold mt-6" style={{ color: MARINE, fontSize: "clamp(32px, 5vw, 56px)", lineHeight: 1, letterSpacing: "-0.025em" }}>
          4 leviers.<br />1 outil.
        </h2>
      </div>
      <div className="mx-auto grid grid-cols-1 md:grid-cols-2 gap-6" style={{ maxWidth: 1200 }}>
        {cards.map((c, i) => (
          <motion.div
            key={c.tag}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="rounded-[20px] p-10 transition-colors duration-200"
            style={{ background: "rgba(13,27,42,0.05)", border: "1px solid transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${GREEN}55`)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
          >
            <div className="flex items-center gap-3 mb-6">
              <span
                className="text-[11px] font-bold uppercase px-3 py-1 rounded-full"
                style={{ background: `${GREEN}26`, color: GREEN, letterSpacing: "0.12em" }}
              >
                {c.tag}
              </span>
              <c.Icon className="w-9 h-9" style={{ color: GREEN }} strokeWidth={1.6} />
            </div>
            <h3 className="font-bold mb-4 whitespace-pre-line" style={{ color: MARINE, fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              {c.title}
            </h3>
            <p className="text-[14px] leading-[1.5]" style={{ color: "rgba(13,27,42,0.6)" }}>
              {c.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function CoucheManquanteSection() {
  const lines = [
    ["L'écoute de calls analyse le passé.", "Ekko déclenche le move sur le deal en cours."],
    ["Le forecast prédit.", "Ekko fait bouger le forecast."],
    ["La vidéo perso produit du contenu.", "Ekko produit votre voix exec, sur chaque deal."],
    ["Les communautés donnent des best practices.", "Ekko déclenche la bonne, au bon moment."],
  ];
  return (
    <section className="px-5 py-20 md:py-36" style={{ background: MARINE }}>
      <div className="mx-auto text-center" style={{ maxWidth: 900 }}>
        <Eyebrow>Pourquoi Ekko</Eyebrow>
        <h2 className="font-bold mt-8 mb-14" style={{ color: IVORY, fontSize: "clamp(32px, 5vw, 56px)", lineHeight: 1, letterSpacing: "-0.025em" }}>
          La couche manquante<br />de votre stack Sales.
        </h2>
        <p className="italic mx-auto mb-20" style={{ color: "rgba(247,246,243,0.75)", fontSize: "clamp(17px, 2vw, 22px)", lineHeight: 1.4, maxWidth: 640 }}>
          Vos outils collectent.<br />Ekko orchestre.
        </p>
        <div className="flex flex-col gap-4 mx-auto" style={{ maxWidth: 760 }}>
          {lines.map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 text-left py-4"
              style={{ borderTop: i === 0 ? "none" : "1px solid rgba(247,246,243,0.1)" }}
            >
              <div className="text-[15px] italic" style={{ color: "rgba(247,246,243,0.55)" }}>{l[0]}</div>
              <div className="text-[15px] font-bold" style={{ color: IVORY }}>{l[1]}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PourQuiSection() {
  const cards = [
    {
      tag: "UTILISATEUR", title: "Account Executive",
      body: "Voyez le comité bouger.\nSachez quoi faire.\nFaites-le en 1 clic.",
      highlight: false,
    },
    {
      tag: "ACHETEUR", title: "VP Sales · CRO",
      body: "Vos AE moyens exécutent comme vos top.\nForecast solide. Variance qui baisse.",
      highlight: true,
    },
    {
      tag: "PARTENAIRE", title: "Dirigeants",
      body: "Présent sur 100% des deals stratégiques.\nSans bloquer 30 minutes.",
      highlight: false,
    },
  ];
  return (
    <section className="px-5 py-20 md:py-36" style={{ background: IVORY }}>
      <div className="mx-auto text-center mb-14" style={{ maxWidth: 1000 }}>
        <Eyebrow>Pour qui</Eyebrow>
        <h2 className="font-bold mt-6" style={{ color: MARINE, fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          Construit pour l'AE.<br />Adopté par le VP.
        </h2>
      </div>
      <div className="mx-auto grid grid-cols-1 md:grid-cols-3 gap-5" style={{ maxWidth: 1100 }}>
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.12 }}
            className="rounded-[16px] p-8 transition-colors duration-200"
            style={{
              background: "rgba(13,27,42,0.04)",
              border: c.highlight ? `1px solid ${GREEN}` : "1px solid transparent",
            }}
            onMouseEnter={(e) => !c.highlight && (e.currentTarget.style.borderColor = `${GREEN}55`)}
            onMouseLeave={(e) => !c.highlight && (e.currentTarget.style.borderColor = "transparent")}
          >
            <span
              className="inline-block text-[11px] font-bold uppercase px-3 py-1 rounded-full mb-5"
              style={{ background: `${GREEN}26`, color: GREEN, letterSpacing: "0.12em" }}
            >
              {c.tag}
            </span>
            <h3 className="text-[22px] font-bold mb-4" style={{ color: MARINE }}>{c.title}</h3>
            <p className="text-[14px] leading-[1.55] whitespace-pre-line" style={{ color: "rgba(13,27,42,0.65)" }}>
              {c.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FounderSection() {
  return (
    <section className="px-5 py-20 md:py-32" style={{ background: IVORY }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto text-center"
        style={{ maxWidth: 720 }}
      >
        <div
          className="w-[120px] h-[120px] rounded-full mx-auto mb-8 flex items-center justify-center"
          style={{ background: MARINE }}
        >
          <span style={{ fontFamily: "'Instrument Serif', serif", color: IVORY, fontSize: 48, fontStyle: "italic" }}>
            J
          </span>
        </div>
        <Eyebrow>Founder</Eyebrow>
        <h3 className="font-bold mt-4 mb-8" style={{ color: MARINE, fontSize: "clamp(28px, 3.6vw, 36px)", lineHeight: 1.05 }}>
          Je l'ai fait avant<br />de le construire.
        </h3>
        <p className="text-[17px] leading-[1.55] mb-6" style={{ color: "rgba(13,27,42,0.7)" }}>
          AE enterprise pendant des années.<br />
          J'ai vécu les deal reviews tendues, les VP surchargés,<br />
          les équipes qui plafonnent.
        </p>
        <p className="text-[17px] leading-[1.55] mb-8" style={{ color: "rgba(13,27,42,0.7)" }}>
          Ekko, c'est ce qui m'aurait permis<br />
          d'aider mon équipe à gagner.
        </p>
        <p className="text-[16px] font-bold" style={{ color: MARINE }}>Julien · founder Ekko</p>
        <a href="mailto:julien@getekko.eu" className="text-[14px] underline mt-2 inline-block" style={{ color: "rgba(13,27,42,0.6)" }}>
          julien@getekko.eu
        </a>
      </motion.div>
    </section>
  );
}

/* ================================================================
   NAV + HERO + FOOTER + PAGE
   ================================================================ */

function Nav() {
  return (
    <nav
      className="sticky top-0 z-50 px-5 md:px-10 py-4 flex items-center justify-between"
      style={{
        background: "rgba(247,246,243,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(13,27,42,0.06)",
      }}
    >
      <span
        className="text-[24px] italic font-normal"
        style={{ color: MARINE, fontFamily: "'Instrument Serif', serif" }}
      >
        Ekko
      </span>
      <button
        type="button"
        onClick={() => scrollToId("form")}
        className="rounded-full font-bold text-[13px] px-5 py-2.5 transition-all duration-200"
        style={{ background: GREEN, color: MARINE }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.filter = "")}
      >
        Demander une démo
      </button>
    </nav>
  );
}

function Hero() {
  return (
    <>
      <section className="px-5 pt-20 md:pt-36 text-center" style={{ background: IVORY }}>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[11px] font-semibold uppercase mb-6"
          style={{ color: GREEN, letterSpacing: "0.28em" }}
        >
          L'EXÉCUTION DES ÉQUIPES SALES B2B
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-bold mx-auto"
          style={{
            color: MARINE,
            fontSize: "clamp(44px, 8.5vw, 88px)",
            lineHeight: 0.92,
            letterSpacing: "-0.025em",
            maxWidth: 980,
          }}
        >
          Le levier qui transforme<br />une équipe Sales.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mx-auto mt-8 leading-[1.4]"
          style={{ color: "rgba(13,27,42,0.65)", fontSize: "clamp(17px, 1.8vw, 20px)", maxWidth: 640 }}
        >
          Coaching contextuel. Signaux du comité.<br />
          Vidéo perso, vidéo exec, atelier ROI.<br />
          Vos AE moyens exécutent comme vos top.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 mb-24 md:mb-32"
        >
          <button
            type="button"
            onClick={() => scrollToId("form")}
            className="rounded-full font-bold text-[15px] transition-all duration-200"
            style={{ background: GREEN, color: MARINE, height: 56, padding: "0 32px" }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "")}
          >
            Demander une démo
          </button>
          <button
            type="button"
            onClick={() => scrollToId("produit")}
            className="text-[16px] underline underline-offset-4"
            style={{ color: "rgba(13,27,42,0.7)" }}
          >
            Voir Ekko sur un deal réel
          </button>
        </motion.div>
      </section>

      <section id="produit" className="px-5 pb-20 md:pb-32" style={{ background: IVORY }}>
        <ProductVisual />
      </section>
    </>
  );
}

function Footer() {
  return (
    <footer className="px-5 py-14" style={{ background: MARINE }}>
      <div className="mx-auto flex flex-col items-center gap-3 text-center" style={{ maxWidth: 1200 }}>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px]" style={{ color: "rgba(247,246,243,0.6)" }}>
          <span className="text-[18px] italic" style={{ fontFamily: "'Instrument Serif', serif", color: IVORY }}>Ekko</span>
          <span>·</span>
          <span>Mentions</span>
          <span>·</span>
          <span>Confidentialité</span>
          <span>·</span>
          <span>CGU</span>
          <span>·</span>
          <a href="mailto:julien@getekko.eu" className="underline">julien@getekko.eu</a>
        </div>
        <p className="text-[12px]" style={{ color: "rgba(247,246,243,0.35)" }}>
          © 2026 Ekko · Paris
        </p>
      </div>
    </footer>
  );
}

export default function Index() {
  return (
    <main style={{ background: IVORY, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes ekkoPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
      <Nav />
      <Hero />
      <ConstatSection />
      <LeviersSection />
      <CoucheManquanteSection />
      <PourQuiSection />
      <FounderSection />
      <FormSection />
      <Footer />
    </main>
  );
}
