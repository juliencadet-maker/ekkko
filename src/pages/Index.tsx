import { useState, useEffect, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, ArrowRight, Sparkles, Send, Plus, Play } from "lucide-react";

const CALENDLY_URL = "https://calendly.com/julien-cadet-getekko/discovery-call";
const IVORY = "#F7F6F3";
const MARINE = "#0D1B2A";
const GREEN = "#1AE08A";
const AMBER = "#E8A838";

const POSTES = [
  "Account Executive",
  "Account Executive Senior",
  "VP Sales",
  "Head of Sales",
  "CRO",
  "Sales Enablement",
  "Sales Ops / RevOps",
  "Autre",
];

type FormState = "idle" | "loading" | "success" | "error";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------- INSIGHT TYPES & DATA ---------------- */

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
    accent: "#1AE08A",
    eyebrow: "NOUVEAU SIGNAL · IL Y A 4 MIN",
    titleLines: ["Brookfield Capital est entré", "dans la boucle"],
    reading:
      "Fonds investisseur. Aucun contact côté fonds engagé. Peut faire pencher ou capoter le deal.",
    nbas: [
      {
        n: "01",
        title: "Auditer le portefeuille",
        lines: ["Vos clients déjà détenus par Brookfield ?"],
        cta: { label: "Lancer l'audit", variant: "outline" },
      },
      {
        n: "02",
        title: "Activer un référent client",
        lines: ["Un client content du fonds en témoin"],
        cta: { label: "Identifier le référent", variant: "outline" },
      },
      {
        n: "03",
        title: "Vérifier l'engagement cloud",
        lines: ["Crédit de consommation à mobiliser ?"],
        cta: { label: "Vérifier l'angle", variant: "outline" },
      },
    ],
  },
  {
    id: "renard",
    accent: "#E8A838",
    eyebrow: "SIGNAL D'ALERTE · 14 JOURS SILENCE",
    titleLines: ["Sophie Renard (DSI) décroche"],
    reading:
      "DRH + DAF très actifs (12 vues cette semaine). Risque concentré sur la fonction technique.",
    nbas: [
      {
        n: "01",
        title: "Atelier sécurité dédié",
        lines: ["Session 1h avec votre architecte"],
        cta: { label: "Proposer l'atelier", variant: "outline" },
      },
      {
        n: "02",
        title: "Engagement pair-to-pair de votre CTO",
        lines: ["Clone vocal · vidéo prête en 4 min"],
        cta: { label: "Envoyer la vidéo CTO", variant: "filled", icon: "play" },
      },
      {
        n: "03",
        title: "Relais via DRH ou DAF",
        lines: ["3-way informel, moins menaçant"],
        cta: { label: "Demander le 3-way", variant: "outline" },
      },
    ],
  },
  {
    id: "rfp",
    accent: "#1AE08A",
    eyebrow: "FENÊTRE DE VISIBILITÉ · IL Y A 12 MIN",
    titleLines: ["3 contacts ouvrent votre RFP"],
    reading:
      "Revue interne du comité acheteur en préparation. Vous êtes un dossier parmi d'autres.",
    nbas: [
      {
        n: "01",
        title: "Renforcer votre réponse",
        lines: ["Addendum ciblé sur les 2 zones d'ombre"],
        cta: { label: "Créer la Deal Room", variant: "outline" },
      },
      {
        n: "02",
        title: "Votre vidéo perso 2 min",
        lines: ["Votre lecture du contexte, en votre nom"],
        cta: { label: "Envoyer ma vidéo", variant: "filled", icon: "play" },
      },
      {
        n: "03",
        title: "Saisir la fenêtre 24h",
        lines: ["Atterrir AVANT la revue interne"],
        cta: { label: "Programmer l'envoi", variant: "outline" },
      },
    ],
  },
];

/* ---------------- INSIGHT PANEL ---------------- */

function InsightPanel({ insight }: { insight: Insight }) {
  const { accent, eyebrow, titleLines, reading, nbas } = insight;
  return (
    <motion.div
      key={insight.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
      transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
      className="absolute inset-0 p-6"
    >
      <div
        className="text-[11px] font-semibold uppercase mb-2"
        style={{ color: accent, letterSpacing: "0.16em" }}
      >
        {eyebrow}
      </div>
      <h3
        className="text-[19px] font-bold leading-[1.3] mb-4"
        style={{ color: IVORY }}
      >
        {titleLines.map((l, i) => (
          <span key={i} className="block">
            {l}
          </span>
        ))}
      </h3>

      {/* Lecture Ekko */}
      <div
        className="rounded-[12px] p-4 md:p-4 mb-5"
        style={{
          background: "rgba(247,246,243,0.05)",
          borderLeft: `2px solid ${accent}66`,
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: accent }} />
          <span
            className="text-[11px] font-semibold uppercase"
            style={{ color: accent, letterSpacing: "0.14em" }}
          >
            Lecture Ekko
          </span>
        </div>
        <p
          className="text-[14px] italic leading-[1.55]"
          style={{ color: "rgba(247,246,243,0.75)" }}
        >
          {reading}
        </p>
      </div>

      {/* NBAs */}
      <div
        className="text-[11px] font-semibold uppercase mb-3"
        style={{ color: "rgba(247,246,243,0.4)", letterSpacing: "0.16em" }}
      >
        Next Best Actions
      </div>
      <div className="flex flex-col gap-3.5">
        {nbas.map((nba) => {
          const Icon = nba.cta.icon === "send" ? Send : nba.cta.icon === "plus" ? Plus : Check;
          const showIcon = nba.cta.variant === "filled" && nba.cta.icon;
          return (
            <div key={nba.n} className="flex gap-3">
              <div
                className="shrink-0 w-6 h-6 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{ background: `${accent}26`, color: accent }}
              >
                {nba.n}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[14px] font-bold leading-[1.3] mb-1.5"
                  style={{ color: "rgba(247,246,243,0.92)" }}
                >
                  {nba.title}
                </div>
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <ul className="space-y-1 flex-1 min-w-0">
                    {nba.lines.map((l, i) => (
                      <li
                        key={i}
                        className="text-[13px] leading-[1.5] pl-3"
                        style={{ color: "rgba(247,246,243,0.55)" }}
                      >
                        <span style={{ color: `${accent}99` }}>→</span> {l}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-[8px] font-bold text-[12px] px-3.5 py-2 transition-all duration-150"
                    style={
                      nba.cta.variant === "filled"
                        ? { background: accent, color: MARINE }
                        : {
                            background: "transparent",
                            color: accent,
                            border: `1px solid ${accent}`,
                          }
                    }
                    onMouseEnter={(e) => {
                      if (nba.cta.variant === "filled") {
                        e.currentTarget.style.filter = "brightness(1.1)";
                      } else {
                        e.currentTarget.style.background = `${accent}1A`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "";
                      if (nba.cta.variant === "outline") {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {showIcon && <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />}
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

/* ---------------- HERO VISUAL : Carousel insights ---------------- */

function HeroScene() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paused) return;
    timer.current = setTimeout(() => {
      setIndex((i) => (i + 1) % INSIGHTS.length);
    }, 12000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [index, paused]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="w-full max-w-[1240px] mx-auto rounded-[24px] overflow-hidden"
      style={{
        background: MARINE,
        boxShadow:
          "0 40px 100px -20px rgba(13,27,42,0.45), 0 12px 32px -8px rgba(13,27,42,0.35)",
        padding: "0",
      }}
    >
      <div className="px-5 md:px-9 pt-5 md:pt-9 pb-0">
        {/* Top bar */}
        <div
          className="flex items-center justify-between pb-5 border-b flex-wrap gap-2"
          style={{ borderColor: "rgba(247,246,243,0.08)" }}
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{
                  background: GREEN,
                  animation: "ekkoPulse 1.5s ease-in-out infinite",
                }}
              />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ background: GREEN }}
              />
            </span>
            <span style={{ color: IVORY }} className="text-[13px] font-medium">
              Deal TotalEnergies · €380k · 4 sponsors actifs
            </span>
          </div>
          <span
            style={{ color: "rgba(247,246,243,0.5)" }}
            className="text-[12px]"
          >
            Lundi 9h12 · live
          </span>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-3">
          {INSIGHTS.map((ins, i) => {
            const active = i === index;
            return (
              <button
                key={ins.id}
                type="button"
                aria-label={`Voir insight ${i + 1}`}
                onClick={() => setIndex(i)}
                className="rounded-[2px] transition-all duration-[600ms]"
                style={{
                  height: 4,
                  width: active ? 24 : 8,
                  background: active ? GREEN : "rgba(247,246,243,0.2)",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Carousel area */}
      <div
        className="relative mx-5 md:mx-9 mb-5 md:mb-6"
        style={{ minHeight: 460 }}
      >
        <AnimatePresence mode="wait">
          <InsightPanel key={INSIGHTS[index].id} insight={INSIGHTS[index]} />
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div
        className="px-6 py-5 text-center text-[14px] border-t"
        style={{
          borderColor: "rgba(247,246,243,0.08)",
          color: "rgba(247,246,243,0.55)",
        }}
      >
        Aussi : PowerMap live · booklet exec · atelier ROI · timing coach
      </div>
    </motion.div>
  );
}

/* ---------------- PAGE ---------------- */

export default function Index() {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [poste, setPoste] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prenom || !nom || !email || !entreprise || !poste) {
      setState("error");
      setErrorMsg("Tous les champs sont requis.");
      return;
    }
    setState("loading");
    setErrorMsg("");
    const { error } = await supabase.functions.invoke("early-access-signup", {
      body: { prenom, nom, email, entreprise, poste },
    });
    if (error) {
      setState("error");
      setErrorMsg("Une erreur est survenue. Réessayez.");
      return;
    }
    setState("success");
  }

  return (
    <div style={{ background: IVORY, color: MARINE }} className="min-h-screen font-sans antialiased">
      <style>{`
        @keyframes ekkoPulse {
          0%, 100% { transform: scale(1); opacity: 0.75; }
          50% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes ekkoGlowGreen {
          0%, 100% { box-shadow: 0 0 0 rgba(26,224,138,0); }
          50% { box-shadow: 0 0 24px rgba(26,224,138,0.18); }
        }
        @keyframes ekkoGlowAmber {
          0%, 100% { box-shadow: 0 0 0 rgba(232,168,56,0); }
          50% { box-shadow: 0 0 24px rgba(232,168,56,0.15); }
        }
        .ekko-cta { transition: transform 200ms ease, filter 200ms ease; }
        .ekko-cta:hover { transform: scale(1.02); filter: brightness(1.05); }
      `}</style>

      {/* NAV */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-md border-b"
        style={{ background: "rgba(247,246,243,0.85)", borderColor: "rgba(13,27,42,0.06)" }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-serif italic text-[26px]" style={{ color: MARINE }}>
            Ekko
          </div>
          <button
            type="button"
            onClick={() => scrollToId("early-access")}
            className="ekko-cta px-5 py-2.5 rounded-full text-[14px] font-semibold"
            style={{ background: GREEN, color: MARINE }}
          >
            Rejoindre le pilote
          </button>
        </div>
      </nav>

      {/* SECTION 1 — HERO */}
      <section className="px-6 pt-14 md:pt-24 pb-20">
        <div className="max-w-[1100px] mx-auto text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-[12px] font-semibold uppercase mb-4"
            style={{ color: GREEN, letterSpacing: "0.14em" }}
          >
            LE COPILOTE QUOTIDIEN DES AE ENTERPRISE
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="font-bold mx-auto"
            style={{
              color: MARINE,
              fontSize: "clamp(44px, 7vw, 72px)",
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              maxWidth: 920,
            }}
          >
            Gagnez plus de deals.
            <br />
            Sans y passer vos soirées.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-6 mx-auto"
            style={{
              color: "rgba(13,27,42,0.65)",
              fontSize: "clamp(17px, 1.6vw, 19px)",
              lineHeight: 1.45,
              maxWidth: 580,
            }}
          >
            Ekko voit ce qui bouge sur chaque deal,
            vous dit quoi faire, et le fait avec vous.
            Tous les jours.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-5"
          >
            <button
              type="button"
              onClick={() => scrollToId("early-access")}
              className="ekko-cta px-7 py-3.5 rounded-full text-[15px] font-semibold"
              style={{ background: GREEN, color: MARINE }}
            >
              Rejoindre le pilote
            </button>
            <button
              type="button"
              onClick={() => scrollToId("demo")}
              className="text-[14px] font-medium underline underline-offset-4"
              style={{ color: "rgba(13,27,42,0.7)" }}
            >
              Voir Ekko sur un deal réel
            </button>
          </motion.div>

          <div className="mt-20">
            <HeroScene />
          </div>
        </div>
      </section>

      {/* SECTION 2 — DÉMO */}
      <section id="demo" className="px-6 py-24 md:py-32" style={{ background: MARINE }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <div
              className="text-[12px] font-semibold uppercase mb-4"
              style={{ color: GREEN, letterSpacing: "0.14em" }}
            >
              EKKO EN 30 SECONDES
            </div>
            <h2
              className="font-bold mx-auto"
              style={{
                color: IVORY,
                fontSize: "clamp(32px, 5vw, 48px)",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              Votre lundi matin.
              <br />
              Sans Ekko, avec Ekko.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Sans Ekko */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="rounded-[20px] p-8 md:p-10"
              style={{ background: "rgba(247,246,243,0.03)" }}
            >
              <span
                className="inline-block text-[11px] font-semibold px-3 py-1 rounded-full mb-5"
                style={{ background: "rgba(247,246,243,0.1)", color: "rgba(247,246,243,0.7)" }}
              >
                SANS EKKO
              </span>
              <h3 className="text-[22px] font-bold mb-6" style={{ color: IVORY }}>
                Vous devinez.
              </h3>
              <ul className="space-y-3.5">
                {[
                  "Vous ouvrez Salesforce. 12 deals. Aucune priorité claire.",
                  "Vous relancez 3 contacts au hasard. Aucun signal sur leur engagement.",
                  "Vous ne savez pas qui regarde votre proposition.",
                  "Le vendredi soir, vous rappelez en panique le DSI silencieux.",
                ].map((t, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-[14px] leading-[1.7]"
                    style={{ color: "rgba(247,246,243,0.65)" }}
                  >
                    <span
                      className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "rgba(232,80,80,0.7)" }}
                    />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Avec Ekko */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-[20px] p-8 md:p-10 border"
              style={{ background: "rgba(26,224,138,0.1)", borderColor: "rgba(26,224,138,0.25)" }}
            >
              <span
                className="inline-block text-[11px] font-semibold px-3 py-1 rounded-full mb-5"
                style={{ background: "rgba(26,224,138,0.2)", color: GREEN }}
              >
                AVEC EKKO
              </span>
              <h3 className="text-[22px] font-bold mb-6" style={{ color: IVORY }}>
                Vous savez.
              </h3>
              <ul className="space-y-3.5">
                {[
                  "Ekko a trié vos 12 deals par signal réel. 3 demandent une action aujourd'hui.",
                  "Brookfield (fonds) est entré dans la boucle. Voici 2 mises en relation activables.",
                  "Sophie (DSI) silencieuse 14j. Voici 3 leviers, script déjà prêt.",
                  "Activez Thomas (CTO groupe) en 1 clic. Vidéo perso en 4 min. Envoyée.",
                ].map((t, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-[14px] leading-[1.7]"
                    style={{ color: "rgba(247,246,243,0.85)" }}
                  >
                    <Check className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: GREEN }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <div className="text-center mt-20">
            <button
              type="button"
              onClick={() => scrollToId("early-access")}
              className="ekko-cta px-7 py-3.5 rounded-full text-[15px] font-semibold"
              style={{ background: GREEN, color: MARINE }}
            >
              Rejoindre le pilote
            </button>
            <div className="mt-4 text-[13px]" style={{ color: "rgba(247,246,243,0.5)" }}>
              20 AE sélectionnés en juin 2026
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — POUR QUI */}
      <section className="px-6 py-24" style={{ background: IVORY }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-12">
            <div
              className="text-[12px] font-semibold uppercase mb-4"
              style={{ color: GREEN, letterSpacing: "0.14em" }}
            >
              POUR QUI
            </div>
            <h2
              className="font-bold"
              style={{ color: MARINE, fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}
            >
              Construit pour l'AE.
              <br />
              Adopté par le VP.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                tagBg: "rgba(26,224,138,0.18)",
                tagColor: GREEN,
                tag: "UTILISATEUR · AE",
                title: "Account Executive",
                text: "Voyez ce qui bouge sur chaque deal. Sachez quoi faire. Faites-le en 1 clic.",
                highlight: true,
              },
              {
                tagBg: "rgba(13,27,42,0.08)",
                tagColor: "rgba(13,27,42,0.6)",
                tag: "ACHETEUR · VP",
                title: "VP Sales / CRO",
                text: "Vos AE moyens exécutent comme vos top performers. Forecast solide. Variance qui baisse.",
              },
              {
                tagBg: "rgba(13,27,42,0.08)",
                tagColor: "rgba(13,27,42,0.6)",
                tag: "PARTENAIRE · EXEC",
                title: "Dirigeants",
                text: "Présent sur 100% des deals stratégiques. Sans bloquer 30 minutes par intervention.",
              },
            ].map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-[18px] p-7 bg-white border transition-colors"
                style={{
                  borderColor: c.highlight ? "rgba(26,224,138,0.45)" : "rgba(13,27,42,0.08)",
                }}
              >
                <span
                  className="inline-block text-[11px] font-semibold px-3 py-1 rounded-full mb-5"
                  style={{ background: c.tagBg, color: c.tagColor }}
                >
                  {c.tag}
                </span>
                <h3 className="text-[22px] font-bold mb-3" style={{ color: MARINE }}>
                  {c.title}
                </h3>
                <p className="text-[14px] leading-[1.6]" style={{ color: "rgba(13,27,42,0.65)" }}>
                  {c.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 — FOUNDER + INSCRIPTION */}
      <section
        id="early-access"
        className="px-6 py-24 md:py-32"
        style={{ background: "rgba(26,224,138,0.12)" }}
      >
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-[2fr_3fr] gap-12 md:gap-16 items-start">
          {/* Founder */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div
              className="w-[100px] h-[100px] rounded-full mb-6 flex items-center justify-center font-serif italic text-[40px]"
              style={{ background: MARINE, color: IVORY }}
            >
              J
            </div>
            <div
              className="text-[12px] font-semibold uppercase mb-3"
              style={{ color: GREEN, letterSpacing: "0.14em" }}
            >
              FOUNDER
            </div>
            <h3
              className="font-bold mb-6"
              style={{ color: MARINE, fontSize: 32, lineHeight: 1.1, letterSpacing: "-0.01em" }}
            >
              Je l'ai fait avant vous.
              <br />
              Maintenant on peut le faire ensemble.
            </h3>
            <div className="space-y-4 text-[15px]" style={{ color: "rgba(13,27,42,0.7)", lineHeight: 1.55 }}>
              <p>Pendant des années, AE en cycle long comme vous.</p>
              <p>
                Chaque deal stratégique me prenait mes soirées et mes weekends.
                Vidéo perso, booklet exec, atelier ROI, suivi du comité à la main.
              </p>
              <p>
                Ekko, c'est l'outil que j'aurais voulu.
                Pour qu'on n'ait plus à choisir entre gagner et avoir une vie.
              </p>
            </div>
            <div className="mt-6 text-[14px] font-bold" style={{ color: MARINE }}>
              Julien · founder Ekko
            </div>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-[13px] underline underline-offset-4"
              style={{ color: "rgba(13,27,42,0.6)" }}
            >
              Me parler 20 min →
            </a>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-[20px] p-8 md:p-9"
            style={{ boxShadow: "0 12px 40px -12px rgba(13,27,42,0.18)" }}
          >
            {state === "success" ? (
              <div className="text-center py-6">
                <div
                  className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
                  style={{ background: "rgba(26,224,138,0.2)" }}
                >
                  <Check className="w-7 h-7" style={{ color: GREEN }} />
                </div>
                <h3 className="text-[24px] font-bold mb-2" style={{ color: MARINE }}>
                  C'est noté.
                </h3>
                <p className="text-[15px] mb-6" style={{ color: "rgba(13,27,42,0.65)" }}>
                  Vous recevez un email dès qu'on ouvre le pilote.
                </p>
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ekko-cta inline-block px-6 py-3 rounded-full text-[14px] font-semibold"
                  style={{ background: GREEN, color: MARINE }}
                >
                  Réserver 20 min avec Julien
                </a>
              </div>
            ) : (
              <>
                <div
                  className="text-[12px] font-semibold uppercase mb-3"
                  style={{ color: GREEN, letterSpacing: "0.14em" }}
                >
                  REJOINDRE LE PILOTE
                </div>
                <h3
                  className="font-bold mb-3"
                  style={{ color: MARINE, fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.01em" }}
                >
                  20 AE. Juin 2026.
                  <br />
                  Vous en êtes ?
                </h3>
                <p className="text-[14px] mb-6" style={{ color: "rgba(13,27,42,0.6)" }}>
                  Aucun engagement. Vous recevez 1 email quand on ouvre.
                </p>

                <form onSubmit={onSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Prénom"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      className="w-full px-4 py-3 rounded-[10px] border text-[14px] outline-none focus:border-[color:var(--g)]"
                      style={{ borderColor: "rgba(13,27,42,0.15)", color: MARINE, ["--g" as any]: GREEN }}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Nom"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      className="w-full px-4 py-3 rounded-[10px] border text-[14px] outline-none focus:border-[color:var(--g)]"
                      style={{ borderColor: "rgba(13,27,42,0.15)", color: MARINE, ["--g" as any]: GREEN }}
                      required
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="Email pro"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-[10px] border text-[14px] outline-none"
                    style={{ borderColor: "rgba(13,27,42,0.15)", color: MARINE }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Entreprise"
                    value={entreprise}
                    onChange={(e) => setEntreprise(e.target.value)}
                    className="w-full px-4 py-3 rounded-[10px] border text-[14px] outline-none"
                    style={{ borderColor: "rgba(13,27,42,0.15)", color: MARINE }}
                    required
                  />
                  <select
                    value={poste}
                    onChange={(e) => setPoste(e.target.value)}
                    className="w-full px-4 py-3 rounded-[10px] border text-[14px] outline-none bg-white"
                    style={{ borderColor: "rgba(13,27,42,0.15)", color: poste ? MARINE : "rgba(13,27,42,0.4)" }}
                    required
                  >
                    <option value="">Poste</option>
                    {POSTES.map((p) => (
                      <option key={p} value={p} style={{ color: MARINE }}>
                        {p}
                      </option>
                    ))}
                  </select>

                  {state === "error" && (
                    <p className="text-[13px]" style={{ color: "#D14848" }}>
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={state === "loading"}
                    className="ekko-cta w-full py-3.5 rounded-full text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: GREEN, color: MARINE }}
                  >
                    {state === "loading" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Envoi...
                      </>
                    ) : (
                      "Je veux être prévenu"
                    )}
                  </button>

                  <p className="text-[12px] text-center" style={{ color: "rgba(13,27,42,0.5)" }}>
                    Pas de spam. Promis.
                  </p>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 py-12" style={{ background: MARINE }}>
        <div
          className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]"
          style={{ color: "rgba(247,246,243,0.6)" }}
        >
          <span className="font-serif italic text-[18px]" style={{ color: IVORY }}>
            Ekko
          </span>
          <span>·</span>
          <a href="#" className="hover:opacity-100">Mentions</a>
          <span>·</span>
          <a href="#" className="hover:opacity-100">Confidentialité</a>
          <span>·</span>
          <a href="#" className="hover:opacity-100">CGU</a>
          <span>·</span>
          <a href="mailto:julien@getekko.eu" className="hover:opacity-100">julien@getekko.eu</a>
        </div>
        <div
          className="text-center mt-3 text-[12px]"
          style={{ color: "rgba(247,246,243,0.4)" }}
        >
          © 2026 Ekko · Paris
        </div>
      </footer>
    </div>
  );
}
