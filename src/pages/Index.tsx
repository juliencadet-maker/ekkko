import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, ArrowRight } from "lucide-react";

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

/* ---------------- HERO VISUAL : Scène réelle ---------------- */

function HeroScene() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[1100px] mx-auto rounded-[24px] overflow-hidden"
      style={{
        background: MARINE,
        boxShadow: "0 40px 100px -20px rgba(13,27,42,0.45), 0 12px 32px -8px rgba(13,27,42,0.35)",
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "rgba(247,246,243,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: GREEN, animation: "ekkoPulse 1.5s ease-in-out infinite" }}
            />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: GREEN }} />
          </span>
          <span style={{ color: IVORY }} className="text-[13px] font-medium">
            Deal TotalEnergies · €380k · 4 sponsors actifs
          </span>
        </div>
        <span style={{ color: "rgba(247,246,243,0.5)" }} className="text-[12px]">
          Lundi 9h12 · live
        </span>
      </div>

      {/* Cards */}
      <div className="p-5 md:p-6 flex flex-col gap-3">
        {/* Card 1 — Signal vert */}
        <div
          className="rounded-[14px] p-5 border-l-[3px] relative overflow-hidden"
          style={{
            borderLeftColor: GREEN,
            background: "rgba(247,246,243,0.08)",
            animation: "ekkoGlowGreen 3s ease-in-out infinite",
          }}
        >
          <div className="text-[11px] font-semibold tracking-[0.12em] mb-2" style={{ color: GREEN }}>
            NOUVEAU SIGNAL · IL Y A 4 MIN
          </div>
          <div className="text-[17px] font-bold leading-snug mb-1" style={{ color: IVORY }}>
            Sarah Levin (Brookfield Capital) a vu votre proposition
          </div>
          <div className="text-[13px] mb-4" style={{ color: "rgba(247,246,243,0.6)" }}>
            Le fonds est dans la boucle. Pas encore adressé.
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full transition"
            style={{ background: "rgba(26,224,138,0.18)", color: GREEN }}
          >
            Voir les 3 next best actions <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Card 2 — Risque amber */}
        <div
          className="rounded-[14px] p-5 border-l-[3px]"
          style={{
            borderLeftColor: AMBER,
            background: "rgba(247,246,243,0.05)",
            animation: "ekkoGlowAmber 3s ease-in-out 1.5s infinite",
          }}
        >
          <div className="text-[11px] font-semibold tracking-[0.12em] mb-2" style={{ color: AMBER }}>
            RISQUE · 14 JOURS SANS SIGNAL
          </div>
          <div className="text-[17px] font-bold leading-snug mb-1" style={{ color: IVORY }}>
            Sophie Renard (DSI) ne répond plus depuis le 28 avril
          </div>
          <div className="text-[13px] mb-4" style={{ color: "rgba(247,246,243,0.6)" }}>
            Sponsor décrocheur. 3 leviers identifiés.
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "rgba(232,168,56,0.15)", color: AMBER }}
          >
            Activer un levier <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Card 3 — Action proposée */}
        <motion.div
          key="card3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: [0, 1, 1, 1, 0], y: [16, 0, 0, 0, -8] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", times: [0, 0.15, 0.5, 0.85, 1] }}
          className="rounded-[14px] p-5 border"
          style={{
            background: "rgba(26,224,138,0.15)",
            borderColor: "rgba(26,224,138,0.35)",
          }}
        >
          <div className="text-[11px] font-semibold tracking-[0.12em] mb-2" style={{ color: GREEN }}>
            NEXT BEST ACTION RECOMMANDÉE
          </div>
          <div className="text-[17px] font-bold leading-snug mb-1.5" style={{ color: IVORY }}>
            Activez Thomas Roche (CTO Groupe) sur ce deal
          </div>
          <div className="text-[13px] mb-4 leading-relaxed" style={{ color: "rgba(247,246,243,0.7)" }}>
            Script personnalisé prêt. Validation 1 clic.
            <br />
            Vidéo perso avec clone vocal en 4 min.
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-full transition hover:brightness-110"
            style={{ background: GREEN, color: MARINE }}
          >
            Voir le script <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </div>

      {/* Footer */}
      <div
        className="px-6 py-4 text-center text-[12px] border-t"
        style={{ borderColor: "rgba(247,246,243,0.08)", color: "rgba(247,246,243,0.4)" }}
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
