import { useState, useEffect, useRef, FormEvent, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  Check, Loader2, Sparkles, Send, Plus, Play,
  Network, PlayCircle, Wand2, User, Users, Crown,
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
   INSIGHT TYPES & DATA (carousel droit du cockpit)
   ================================================================ */

type CTA = { label: string; variant: "filled" | "outline"; icon?: "send" | "plus" | "check" | "play" };
type NBA = { n: string; title: string; lines: string[]; cta: CTA };
type Insight = {
  id: string;
  accent: string;
  eyebrow: string;
  titleLines: string[];
  reading: string;
  nbas: NBA[];
};

const INSIGHTS: Insight[] = [
  {
    id: "brookfield",
    accent: GREEN,
    eyebrow: "NOUVEAU SIGNAL · 4 MIN",
    titleLines: ["Sarah Levin (Brookfield Capital)", "a vu votre proposition"],
    reading:
      "Fonds investisseur dans la boucle. Aucun contact côté fonds engagé. Trois leviers à activer.",
    nbas: [
      { n: "01", title: "Auditer le portefeuille du fonds", lines: ["Vos clients déjà détenus par Brookfield ?"], cta: { label: "Lancer", variant: "outline" } },
      { n: "02", title: "Activer un référent client portfolio", lines: ["Mise en relation client content ↔ prospect"], cta: { label: "Identifier", variant: "outline" } },
      { n: "03", title: "Vérifier l'angle engagement cloud", lines: ["Crédit consommation à mobiliser ?"], cta: { label: "Vérifier", variant: "outline" } },
    ],
  },
  {
    id: "renard",
    accent: AMBER,
    eyebrow: "SIGNAL D'ALERTE · 14 JOURS",
    titleLines: ["Sophie Renard (DSI) décroche"],
    reading: "DRH + DAF très actifs (12 vues cette semaine). Risque concentré sur la fonction technique.",
    nbas: [
      { n: "01", title: "Atelier sécurité dédié", lines: ["Session 1h avec votre architecte"], cta: { label: "Proposer", variant: "outline" } },
      { n: "02", title: "Engagement pair-to-pair de votre CTO", lines: ["Clone vocal · vidéo prête en 4 min"], cta: { label: "Envoyer la vidéo CTO", variant: "filled", icon: "play" } },
      { n: "03", title: "Relais via DRH ou DAF", lines: ["3-way informel, moins menaçant"], cta: { label: "Demander", variant: "outline" } },
    ],
  },
  {
    id: "rfp",
    accent: GREEN,
    eyebrow: "FENÊTRE DE VISIBILITÉ · 12 MIN",
    titleLines: ["3 contacts ouvrent votre réponse RFP"],
    reading: "Revue interne du comité acheteur en préparation. Courte fenêtre pour vous distinguer.",
    nbas: [
      { n: "01", title: "Renforcer votre réponse", lines: ["Addendum ciblé sur les zones d'ombre"], cta: { label: "Créer la Deal Room", variant: "outline" } },
      { n: "02", title: "Votre vidéo perso 2 min", lines: ["Lecture du contexte, en votre nom"], cta: { label: "Envoyer ma vidéo", variant: "filled", icon: "play" } },
      { n: "03", title: "Saisir la fenêtre 24h", lines: ["Atterrir AVANT la revue interne"], cta: { label: "Programmer", variant: "outline" } },
    ],
  },
];

/* ================================================================
   INSIGHT PANEL — colonne AE
   ================================================================ */

function InsightPanel({ insight }: { insight: Insight }) {
  const { accent, eyebrow, titleLines, reading, nbas } = insight;
  return (
    <motion.div
      key={insight.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
      transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
      className="absolute inset-0 p-4"
    >
      <div className="text-[10px] font-semibold uppercase mb-1.5" style={{ color: accent, letterSpacing: "0.16em" }}>
        {eyebrow}
      </div>
      <h3 className="text-[15px] font-bold leading-[1.3] mb-3" style={{ color: IVORY }}>
        {titleLines.map((l, i) => <span key={i} className="block">{l}</span>)}
      </h3>

      <div
        className="rounded-[8px] p-3 mb-4"
        style={{ background: "rgba(247,246,243,0.05)", borderLeft: `2px solid ${accent}` }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles className="w-3 h-3" style={{ color: accent }} />
          <span className="text-[10px] font-semibold uppercase" style={{ color: accent, letterSpacing: "0.14em" }}>
            Lecture Ekko
          </span>
        </div>
        <p className="text-[12px] italic leading-[1.5]" style={{ color: "rgba(247,246,243,0.7)" }}>
          {reading}
        </p>
      </div>

      <div className="text-[10px] font-semibold uppercase mb-2" style={{ color: "rgba(247,246,243,0.4)", letterSpacing: "0.16em" }}>
        Actions recommandées
      </div>
      <div className="flex flex-col gap-2.5">
        {nbas.map((nba) => {
          const Icon = nba.cta.icon === "play" ? Play : nba.cta.icon === "send" ? Send : nba.cta.icon === "plus" ? Plus : Check;
          const showIcon = nba.cta.variant === "filled" && nba.cta.icon;
          return (
            <div key={nba.n} className="flex gap-2.5">
              <div
                className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: `${accent}26`, color: accent }}
              >
                {nba.n}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold leading-[1.3] mb-1" style={{ color: "rgba(247,246,243,0.92)" }}>
                  {nba.title}
                </div>
                <div className="flex items-end justify-between gap-2 flex-wrap">
                  <ul className="space-y-0.5 flex-1 min-w-0">
                    {nba.lines.map((l, i) => (
                      <li key={i} className="text-[11.5px] leading-[1.45] pl-2" style={{ color: "rgba(247,246,243,0.55)" }}>
                        <span style={{ color: `${accent}99` }}>→</span> {l}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1 rounded-[6px] font-bold text-[10.5px] px-2.5 py-1.5 transition-all duration-150"
                    style={
                      nba.cta.variant === "filled"
                        ? { background: accent, color: MARINE }
                        : { background: "transparent", color: accent, border: `1px solid ${accent}` }
                    }
                    onMouseEnter={(e) => {
                      if (nba.cta.variant === "filled") e.currentTarget.style.filter = "brightness(1.08)";
                      else e.currentTarget.style.background = `${accent}1A`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "";
                      if (nba.cta.variant === "outline") e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {showIcon && <Icon className="w-3 h-3" strokeWidth={2.5} />}
                    {nba.cta.label}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ================================================================
   HERO COCKPIT — split VP / AE
   ================================================================ */

function VPColumn() {
  const kpis = [
    { label: "QUOTA Q2 ATTEINT", value: "78%", delta: "+14 pts vs Q1", color: GREEN },
    { label: "AE QUI FONT 100%+", value: "7/12", delta: "vs 3/12 au Q1", color: GREEN },
    { label: "DEALS À RISQUE", value: "3", delta: "Actions recommandées disponibles", color: AMBER },
  ];
  const deals = [
    { name: "TotalEnergies · 380k€", tag: "ACCÉLÈRE", ae: "AE : Thomas", color: GREEN },
    { name: "Crédit Mutuel · 220k€", tag: "À DÉBLOQUER", ae: "AE : Marc", color: AMBER },
    { name: "Banque Postale · 450k€", tag: "VOTRE INTERVENTION", ae: "AE : Pierre", color: RED, glow: true },
  ];
  return (
    <div className="flex flex-col">
      <div className="text-[10px] font-semibold uppercase mb-2" style={{ color: "rgba(247,246,243,0.5)", letterSpacing: "0.18em" }}>
        Vue équipe
      </div>
      <div className="text-[16px] font-bold mb-4" style={{ color: IVORY }}>
        Tableau de bord · Q2 2026
      </div>

      <div className="flex flex-col gap-3 mb-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + i * 0.1, duration: 0.4 }}
            className="rounded-[10px] p-4"
            style={{ background: "rgba(247,246,243,0.05)" }}
          >
            <div className="text-[11px] font-semibold uppercase mb-1" style={{ color: "rgba(247,246,243,0.5)", letterSpacing: "0.12em" }}>
              {k.label}
            </div>
            <div className="text-[28px] font-bold leading-none mb-1" style={{ color: IVORY }}>{k.value}</div>
            <div className="text-[12px]" style={{ color: k.color }}>{k.delta}</div>
          </motion.div>
        ))}
      </div>

      <div className="text-[10px] font-semibold uppercase mb-2" style={{ color: "rgba(247,246,243,0.4)", letterSpacing: "0.16em" }}>
        Deals critiques cette semaine
      </div>
      <div className="flex flex-col gap-2">
        {deals.map((d, i) => (
          <motion.div
            key={d.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 + i * 0.12, duration: 0.4 }}
            className="rounded-[8px] p-3"
            style={{
              background: "rgba(247,246,243,0.04)",
              borderLeft: `2px solid ${d.color}`,
              boxShadow: d.glow ? `0 0 0 1px ${d.color}33, 0 0 24px -4px ${d.color}55` : undefined,
              animation: d.glow ? "pulseGlow 4s ease-in-out infinite" : undefined,
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[12.5px] font-bold" style={{ color: IVORY }}>{d.name}</div>
              <span
                className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: `${d.color}22`, color: d.color, letterSpacing: "0.1em" }}
              >
                {d.tag}
              </span>
            </div>
            <div className="text-[11px]" style={{ color: "rgba(247,246,243,0.5)" }}>{d.ae}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AEColumn() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % INSIGHTS.length), 12000);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div className="flex flex-col">
      <div className="text-[10px] font-semibold uppercase mb-2" style={{ color: "rgba(247,246,243,0.5)", letterSpacing: "0.18em" }}>
        Deal en cours · Marc
      </div>
      <div className="text-[16px] font-bold mb-3" style={{ color: IVORY }}>
        Crédit Mutuel · 220k€
      </div>

      <div className="flex justify-center gap-1.5 mb-2">
        {INSIGHTS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Insight ${i + 1}`}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === idx ? 20 : 6,
              height: 4,
              background: i === idx ? GREEN : "rgba(247,246,243,0.25)",
            }}
          />
        ))}
      </div>

      <div
        ref={ref}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="relative rounded-[14px] overflow-hidden"
        style={{
          background: "rgba(247,246,243,0.03)",
          border: "1px solid rgba(247,246,243,0.08)",
          minHeight: 460,
        }}
      >
        <AnimatePresence mode="wait">
          <InsightPanel key={INSIGHTS[idx].id} insight={INSIGHTS[idx]} />
        </AnimatePresence>
      </div>
    </div>
  );
}

function HeroCockpit() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
      className="mx-auto rounded-[28px] p-4 md:p-10"
      style={{
        background: MARINE,
        maxWidth: 1320,
        boxShadow: "0 40px 80px -20px rgba(13,27,42,0.25)",
      }}
    >
      {/* TOP BAR */}
      <div
        className="flex items-center justify-between pb-5 md:pb-7 mb-6 md:mb-7 flex-wrap gap-3"
        style={{ borderBottom: "1px solid rgba(247,246,243,0.08)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="relative inline-flex w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full" style={{ background: GREEN, animation: "ekkoPulse 1.5s ease-in-out infinite" }} />
            <span className="relative inline-flex rounded-full w-2.5 h-2.5" style={{ background: GREEN }} />
          </span>
          <span className="text-[13px]" style={{ color: IVORY }}>
            Pigment · Équipe Sales · 12 AE actifs
          </span>
        </div>
        <span className="hidden md:block text-[12px] italic" style={{ color: "rgba(247,246,243,0.4)" }}>
          Vue partagée VP ↔ AE en temps réel
        </span>
        <span className="text-[12px]" style={{ color: "rgba(247,246,243,0.5)" }}>
          Mardi 8h47 · live
        </span>
      </div>

      {/* SPLIT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <VPColumn />
        <AEColumn />
      </div>

      {/* PIED */}
      <div className="mt-6 pt-6 text-center" style={{ borderTop: "1px solid rgba(247,246,243,0.08)" }}>
        <p className="text-[13px]" style={{ color: "rgba(247,246,243,0.55)" }}>
          Aussi : booklet exec · atelier ROI · timing coach · PowerMap live · suivi engagement
        </p>
      </div>
    </motion.div>
  );
}

/* ================================================================
   FORM SECTION
   ================================================================ */

const ROLE_OPTIONS: { value: Exclude<Role, "">; label: string; cta: string }[] = [
  { value: "vp", label: "VP Sales / CRO / Head of Sales", cta: "Réserver ma démo de 20 min" },
  { value: "ae", label: "Account Executive (Senior, Enterprise)", cta: "Rejoindre la liste pilote bêta" },
  { value: "exec", label: "Dirigeant (CEO, COO, DG)", cta: "Recevoir la note Ekko" },
  { value: "other", label: "Autre rôle Sales", cta: "M'envoyer plus d'infos" },
];

function DemoSection() {
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
    } catch (err: any) {
      setState("error");
      setErrMsg("Une erreur est survenue. Réessayez ou écrivez à julien@getekko.eu");
    }
  };

  return (
    <section
      id="demo"
      className="px-5 py-20 md:py-32"
      style={{ background: `${GREEN}1F` }}
    >
      <div className="mx-auto grid grid-cols-1 md:grid-cols-[40%_1fr] gap-12 md:gap-20" style={{ maxWidth: 1200 }}>
        {/* Founder */}
        <div>
          <div
            className="w-[110px] h-[110px] rounded-full mb-6 flex items-center justify-center text-[36px] font-bold"
            style={{ background: MARINE, color: IVORY }}
          >
            J
          </div>
          <div className="text-[11px] font-semibold uppercase mb-3" style={{ color: GREEN, letterSpacing: "0.18em" }}>
            Founder
          </div>
          <h3 className="font-bold mb-6" style={{ color: MARINE, fontSize: "clamp(28px, 4vw, 36px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Je l'ai fait avant<br />de le construire.
          </h3>
          <div className="space-y-4 text-[16px] leading-[1.6]" style={{ color: "rgba(13,27,42,0.7)" }}>
            <p>Pendant des années, AE enterprise en cycle long. J'ai vécu les deal reviews tendues, les VP surchargés, et l'équipe moyenne qui plafonne à 70-80% de quota.</p>
            <p>Ekko est l'outil qui aurait permis à mon VP de faire de moi un top performer en 6 mois. Pas en 3 ans. Et qui aurait permis aux 8 autres AE de mon équipe de gagner aussi.</p>
            <p>Si vous gérez une équipe Sales B2B, ou si vous êtes AE en cycle long et voulez tester en pilote, parlons 20 minutes.</p>
          </div>
          <p className="mt-6 text-[15px] font-bold" style={{ color: MARINE }}>Julien · founder Ekko</p>
          <a href="mailto:julien@getekko.eu" className="text-[14px] underline mt-1 inline-block" style={{ color: "rgba(13,27,42,0.6)" }}>
            julien@getekko.eu
          </a>
        </div>

        {/* Form */}
        <div className="rounded-[20px] p-8 md:p-11 bg-white" style={{ boxShadow: "0 20px 50px -20px rgba(13,27,42,0.15)" }}>
          {state === "success" ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: `${GREEN}33` }}>
                <Check className="w-7 h-7" style={{ color: GREEN }} strokeWidth={3} />
              </div>
              <h3 className="text-[24px] font-bold mb-2" style={{ color: MARINE }}>Reçu.</h3>
              <p className="text-[15px]" style={{ color: "rgba(13,27,42,0.65)" }}>
                Je reviens vers vous sous 24h à l'adresse {email}.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="text-[11px] font-semibold uppercase mb-1" style={{ color: GREEN, letterSpacing: "0.16em" }}>
                Rejoignez Ekko
              </div>
              <h3 className="text-[26px] md:text-[30px] font-bold leading-[1.05] mb-2" style={{ color: MARINE, letterSpacing: "-0.02em" }}>
                Une démo. Une note.<br />Ou un pilote bêta.
              </h3>
              <p className="text-[15px] leading-[1.55] mb-5" style={{ color: "rgba(13,27,42,0.65)" }}>
                Selon votre rôle, je vous propose le bon format. Aucun engagement, aucun pitch dans le premier échange.
              </p>

              <div className="grid grid-cols-2 gap-3">
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
                    Envoi en cours…
                  </span>
                ) : ctaLabel}
              </button>

              <p className="text-center text-[12px]" style={{ color: "rgba(13,27,42,0.5)" }}>
                Pas de spam. Réponse personnalisée sous 24h.
              </p>
            </form>
          )}
        </div>
      </div>
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
   SECTIONS — constat / leviers / différenciation / pour qui
   ================================================================ */

function ConstatSection() {
  return (
    <section className="px-5 py-20 md:py-40" style={{ background: MARINE }}>
      <div className="mx-auto text-center" style={{ maxWidth: 900 }}>
        <Eyebrow>La réalité d'une équipe Sales B2B</Eyebrow>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="font-bold mt-6 mb-12"
          style={{ color: IVORY, fontSize: "clamp(32px, 5vw, 56px)", lineHeight: 1, letterSpacing: "-0.02em" }}
        >
          20% de vos AE font 80% du chiffre.<br />Vous le savez. Eux aussi.
        </motion.h2>
        <div className="space-y-6 text-[19px] leading-[1.55] mx-auto" style={{ color: "rgba(247,246,243,0.75)", maxWidth: 760 }}>
          <p>
            Vos top performers ont des automatismes : lecture du comité, le bon move au bon moment, activation d'un exec en 1 clic, suivi multi-thread. Pas du talent inné — de la mécanique apprise.
          </p>
          <p>
            Aujourd'hui, transmettre cette mécanique repose sur les 1:1 hebdomadaires des VP, les weekends de proposition retravaillée, et l'expérience tribale d'équipe. Lent, fragile, non-scalable.
          </p>
        </div>
        <p className="font-bold mt-12" style={{ color: IVORY, fontSize: "clamp(22px, 2.5vw, 28px)" }}>
          Et si chaque AE avait ces automatismes<br />dans sa poche ?
        </p>
      </div>
    </section>
  );
}

function LeviersSection() {
  const cards = [
    {
      n: "01 · COACHING",
      Icon: Sparkles,
      title: "Le bon move sur chaque deal.\nSans 1:1 hebdomadaire.",
      body: "Ekko lit le contexte de chaque deal — signaux du comité, stage, historique — et propose 3 actions stratégiques avec sous-actions exécutables. Vos AE arrivent en deal review armés, repartent avec un plan. Vos top deviennent encore plus précis.",
      footer: "Pour l'AE et le VP",
    },
    {
      n: "02 · POWERMAP",
      Icon: Network,
      title: "Voyez ce qui se passe\nquand vous n'êtes pas là.",
      body: "Qui regarde, qui forward, qui réagit dans le comité acheteur. Détection automatique des nouveaux contacts (un fonds, un DRH, un nouveau sponsor). La carte vivante du comité s'actualise en temps réel, sans vous demander de la maintenir.",
      footer: "Pour l'AE et le VP",
    },
    {
      n: "03 · VIDÉO EXEC",
      Icon: PlayCircle,
      title: "Votre voix sur chaque deal.\nSans bloquer 30 minutes.",
      body: "Vous validez en 1 clic. Ekko produit la vidéo personnalisée avec votre clone vocal en 4 minutes. Vos AE peuvent activer votre intervention exec sur 100% des deals stratégiques, pas seulement le top 3 que vous avez le temps de suivre.",
      footer: "Pour le VP et les dirigeants",
    },
    {
      n: "04 · ASSETS",
      Icon: Wand2,
      title: "Vidéo perso, booklet exec,\natelier ROI. En 5 minutes.",
      body: "L'AE parle 30 secondes. Ekko produit la vidéo perso, le booklet exec ou l'atelier ROI personnalisé pour le prospect. Différenciation à l'échelle, sans soirées sacrifiées. Le travail des top, accessible à toute l'équipe.",
      footer: "Pour l'AE",
    },
  ];
  return (
    <section className="px-5 py-20 md:py-36" style={{ background: IVORY }}>
      <div className="mx-auto text-center mb-16" style={{ maxWidth: 1100 }}>
        <Eyebrow>Ce qu'Ekko orchestre</Eyebrow>
        <h2 className="font-bold mt-6" style={{ color: MARINE, fontSize: "clamp(32px, 5vw, 56px)", lineHeight: 1, letterSpacing: "-0.02em" }}>
          4 leviers que vos top<br />utilisent déjà à la main.
        </h2>
      </div>
      <div className="mx-auto grid grid-cols-1 md:grid-cols-2 gap-6" style={{ maxWidth: 1200 }}>
        {cards.map((c, i) => (
          <motion.div
            key={c.n}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
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
                {c.n}
              </span>
              <c.Icon className="w-9 h-9" style={{ color: GREEN }} strokeWidth={1.6} />
            </div>
            <h3 className="font-bold mb-4 whitespace-pre-line" style={{ color: MARINE, fontSize: 26, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
              {c.title}
            </h3>
            <p className="text-[15px] leading-[1.55]" style={{ color: "rgba(13,27,42,0.65)" }}>
              {c.body}
            </p>
            <p className="text-[12px] mt-6" style={{ color: "rgba(13,27,42,0.4)" }}>{c.footer}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function DifferenciationSection() {
  const lines = [
    ["Gong analyse les calls passés.", "Ekko déclenche le bon move sur le deal en cours."],
    ["Clari fait votre forecast.", "Ekko déclenche les actions qui font bouger le forecast."],
    ["Vidyard produit des vidéos perso.", "Ekko produit votre voix exec en clone vocal, sur chaque deal."],
    ["Pavilion donne des best practices dans Slack.", "Ekko déclenche la bonne best practice au bon moment, sur le bon deal."],
  ];
  return (
    <section className="px-5 py-20 md:py-32" style={{ background: MARINE }}>
      <div className="mx-auto text-center" style={{ maxWidth: 920 }}>
        <Eyebrow>Mais vous avez déjà des outils</Eyebrow>
        <h2 className="font-bold mt-6 mb-6" style={{ color: IVORY, fontSize: "clamp(28px, 4.5vw, 48px)", lineHeight: 1, letterSpacing: "-0.02em" }}>
          Ekko n'est pas un Gong de plus.<br />C'est la couche manquante.
        </h2>
        <p className="text-[18px] italic mb-12" style={{ color: "rgba(247,246,243,0.7)" }}>
          Vos outils actuels collectent. Ekko orchestre.
        </p>
        <div className="flex flex-col gap-3 mb-12">
          {lines.map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-[12px] px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 items-center text-left"
              style={{ background: "rgba(247,246,243,0.05)" }}
            >
              <div className="text-[15px] italic" style={{ color: "rgba(247,246,243,0.65)" }}>{l[0]}</div>
              <div
                className="text-[15px] font-bold md:pl-6"
                style={{ color: IVORY, borderLeft: "1px solid rgba(247,246,243,0.1)" }}
              >
                <span className="md:hidden block w-12 h-px my-2" style={{ background: "rgba(247,246,243,0.15)" }} />
                {l[1]}
              </div>
            </motion.div>
          ))}
        </div>
        <p className="text-[16px] italic" style={{ color: "rgba(247,246,243,0.55)" }}>
          Ekko ne remplace pas votre stack. Ekko orchestre l'exécution sur chaque deal.<br />C'est la couche manquante entre vos signaux et vos actions.
        </p>
      </div>
    </section>
  );
}

function PourQuiSection() {
  const cards = [
    {
      tag: "01 · UTILISATEUR", Icon: User, title: "Account Executive",
      body: "Voyez ce qui bouge sur chaque deal. Sachez quoi faire. Activez votre exec en 1 clic. Produisez vidéo perso ou booklet en 5 minutes au lieu de 2 heures.",
      footer: "Ouvert tous les jours. Pas seulement en deal review.",
      highlight: false,
    },
    {
      tag: "02 · ACHETEUR", Icon: Users, title: "VP Sales / CRO",
      body: "Vos AE moyens exécutent comme vos top. Forecast solide, variance qui baisse, deal reviews offensives. Vous arrêtez de coacher 1:1 ce qui peut être systématisé.",
      footer: "L'effet de levier que vous cherchiez sur votre équipe.",
      highlight: true,
    },
    {
      tag: "03 · PARTENAIRE", Icon: Crown, title: "Dirigeants",
      body: "Présent sur 100% des deals stratégiques. Sans bloquer 30 minutes par intervention. Votre clone vocal valide en 1 clic et la vidéo part.",
      footer: "Votre temps d'exec, démocratisé.",
      highlight: false,
    },
  ];
  return (
    <section className="px-5 py-20 md:py-32" style={{ background: IVORY }}>
      <div className="mx-auto text-center mb-14" style={{ maxWidth: 1000 }}>
        <Eyebrow>Pour qui</Eyebrow>
        <h2 className="font-bold mt-6" style={{ color: MARINE, fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          Construit pour l'AE.<br />Acheté par le VP.<br />Adoré par les dirigeants.
        </h2>
      </div>
      <div className="mx-auto grid grid-cols-1 md:grid-cols-3 gap-5" style={{ maxWidth: 1200 }}>
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: c.highlight ? 0.2 : i * 0.1 }}
            className="rounded-[16px] p-8 transition-colors duration-200"
            style={{
              background: c.highlight ? "rgba(13,27,42,0.08)" : "rgba(13,27,42,0.05)",
              border: c.highlight ? `1px solid ${GREEN}66` : "1px solid transparent",
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
            <c.Icon className="w-7 h-7 mb-4" style={{ color: GREEN }} strokeWidth={1.6} />
            <h3 className="text-[22px] font-bold mb-3" style={{ color: MARINE }}>{c.title}</h3>
            <p className="text-[14px] leading-[1.5] mb-5" style={{ color: "rgba(13,27,42,0.7)" }}>{c.body}</p>
            <p className="text-[12px] italic" style={{ color: "rgba(13,27,42,0.5)" }}>{c.footer}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block text-[12px] font-semibold uppercase"
      style={{ color: GREEN, letterSpacing: "0.18em" }}
    >
      {children}
    </span>
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
        onClick={() => scrollToId("demo")}
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
    <section className="px-5 pt-16 md:pt-28 pb-12 md:pb-16 text-center" style={{ background: IVORY }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-[12px] font-semibold uppercase mb-5"
        style={{ color: GREEN, letterSpacing: "0.16em" }}
      >
        Outil d'exécution pour les équipes Sales B2B
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="font-bold mx-auto"
        style={{
          color: MARINE,
          fontSize: "clamp(44px, 8vw, 84px)",
          lineHeight: 0.92,
          letterSpacing: "-0.025em",
          maxWidth: 1100,
        }}
      >
        Le levier qui transforme<br />une équipe Sales.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mx-auto mt-7 text-[17px] md:text-[22px] leading-[1.45]"
        style={{ color: "rgba(13,27,42,0.65)", maxWidth: 720 }}
      >
        Ekko orchestre la lecture des signaux du comité, le bon move au bon moment, et la production des assets différenciants (vidéo perso, vidéo exec, atelier ROI) — pour que vos AE moyens exécutent comme vos top, et que vos top deviennent inarrêtables.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-11 mb-20 md:mb-24"
      >
        <button
          type="button"
          onClick={() => scrollToId("demo")}
          className="rounded-full font-bold text-[15px] px-7 py-3.5 transition-all duration-200"
          style={{ background: GREEN, color: MARINE }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.filter = "")}
        >
          Demander une démo
        </button>
        <button
          type="button"
          onClick={() => scrollToId("cockpit")}
          className="text-[14px] underline underline-offset-4"
          style={{ color: "rgba(13,27,42,0.7)" }}
        >
          Voir Ekko sur un deal réel
        </button>
      </motion.div>

      <div id="cockpit">
        <HeroCockpit />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-5 py-12" style={{ background: MARINE }}>
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
        <p className="text-[12px]" style={{ color: "rgba(247,246,243,0.4)" }}>
          © 2026 Ekko · Paris · Made by an AE
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
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 1px ${RED}33, 0 0 24px -4px ${RED}55; }
          50% { box-shadow: 0 0 0 1px ${RED}66, 0 0 36px -2px ${RED}88; }
        }
      `}</style>
      <Nav />
      <Hero />
      <ConstatSection />
      <LeviersSection />
      <DifferenciationSection />
      <PourQuiSection />
      <DemoSection />
      <Footer />
    </main>
  );
}
