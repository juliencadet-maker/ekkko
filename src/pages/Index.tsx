import { useState, FormEvent, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Sparkles, Play, Check, Loader2, ArrowRight } from "lucide-react";

const CALENDLY_URL = "https://calendly.com/julien-cadet-getekko/discovery-call";
const IVORY = "#F7F6F3";
const MARINE = "#0D1B2A";
const GREEN = "#1AE08A";

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

/* ---------------- HERO VISUAL ---------------- */

function Waveform() {
  return (
    <div className="flex items-end justify-center gap-[3px] h-7 mt-3">
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            background: i % 3 === 0 ? GREEN : "rgba(247,246,243,0.55)",
            animation: `wave 0.9s ease-in-out ${i * 60}ms infinite`,
          }}
        />
      ))}
    </div>
  );
}

function ArrowFlow() {
  return (
    <div className="hidden md:flex items-center justify-center px-2">
      <ArrowRight
        size={26}
        style={{ color: GREEN, animation: "arrowSlide 1.5s ease-in-out infinite" }}
      />
    </div>
  );
}

function HeroVisual() {
  const checks = ["Script généré", "Voix clonée", "Vidéo rendue"];
  return (
    <div
      className="relative mx-auto w-full max-w-[1100px] rounded-[24px] overflow-hidden"
      style={{
        background: MARINE,
        boxShadow: "0 40px 80px -20px rgba(13,27,42,0.35), 0 20px 40px -20px rgba(13,27,42,0.25)",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-6 md:gap-0 p-6 md:p-10">
        {/* COL 1 — VOUS */}
        <div className="flex flex-col items-center text-center px-2">
          <span
            className="text-[10px] font-semibold tracking-[0.2em] px-2.5 py-1 rounded-full"
            style={{ background: "rgba(26,224,138,0.15)", color: GREEN }}
          >
            VOUS
          </span>
          <div className="relative my-6 flex items-center justify-center w-24 h-24">
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: "rgba(247,246,243,0.08)",
                animation: "pulseRing 1.6s ease-out infinite",
              }}
            />
            <Mic size={48} color={IVORY} />
          </div>
          <p
            className="italic text-[13px] leading-snug max-w-[220px]"
            style={{ color: "rgba(247,246,243,0.6)" }}
          >
            « Bonjour Sophie, suite à notre échange... »
          </p>
          <Waveform />
          <span
            className="mt-4 text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: "rgba(247,246,243,0.08)", color: "rgba(247,246,243,0.6)" }}
          >
            30 sec
          </span>
        </div>

        <ArrowFlow />

        {/* COL 2 — EKKO */}
        <div className="flex flex-col items-center text-center px-2">
          <span
            className="text-[10px] font-semibold tracking-[0.2em] px-2.5 py-1 rounded-full"
            style={{ background: "rgba(26,224,138,0.15)", color: GREEN }}
          >
            EKKO
          </span>
          <div className="my-6 flex items-center justify-center w-24 h-24">
            <Sparkles
              size={48}
              color={GREEN}
              style={{ animation: "spinSlow 10s linear infinite" }}
            />
          </div>
          <ul className="space-y-1.5 text-[13px] text-left" style={{ color: IVORY }}>
            {checks.map((c, i) => (
              <li
                key={c}
                className="flex items-center gap-2"
                style={{
                  opacity: 0,
                  animation: `fadeIn 400ms ease-out ${800 + i * 800}ms forwards`,
                }}
              >
                <Check size={14} color={GREEN} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <span className="mt-4 text-[11px] font-medium" style={{ color: GREEN }}>
            4 min 12s
          </span>
        </div>

        <ArrowFlow />

        {/* COL 3 — PRÊT */}
        <div className="flex flex-col items-center text-center px-2">
          <span
            className="text-[10px] font-semibold tracking-[0.2em] px-2.5 py-1 rounded-full"
            style={{ background: "rgba(26,224,138,0.15)", color: GREEN }}
          >
            PRÊT
          </span>
          <div
            className="relative my-6 rounded-[12px] flex items-center justify-center"
            style={{
              width: 200,
              height: 112,
              background: "rgba(247,246,243,0.05)",
              border: "1px solid rgba(247,246,243,0.08)",
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: GREEN }}
            >
              <Play size={20} color={MARINE} fill={MARINE} />
            </div>
            <span
              className="absolute bottom-1.5 right-2 text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(13,27,42,0.7)", color: IVORY }}
            >
              0:42
            </span>
          </div>
          <div
            className="w-full max-w-[220px] rounded-[10px] p-3 text-left"
            style={{ background: "rgba(247,246,243,0.08)" }}
          >
            <p className="text-[13px] font-medium" style={{ color: IVORY }}>
              Vidéo Sophie Renard
            </p>
            <p className="text-[12px]" style={{ color: "rgba(247,246,243,0.5)" }}>
              Envoyée jeudi · vue 3x
            </p>
          </div>
          <button
            className="mt-3 text-[12px] font-semibold px-3 py-1.5 rounded-full"
            style={{ background: GREEN, color: MARINE }}
            type="button"
            tabIndex={-1}
            aria-hidden
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PAGE ---------------- */

export default function Index() {
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    entreprise: "",
    poste: "",
  });
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    document.title = "Ekko — Votre voix. Leurs assets de vente.";
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!form.prenom || !form.nom || !form.email || !form.entreprise || !form.poste) {
      setErrorMsg("Tous les champs sont requis.");
      setState("error");
      return;
    }
    setState("loading");
    try {
      const { error } = await supabase.functions.invoke("early-access-signup", {
        body: form,
      });
      if (error) throw error;
      setState("success");
    } catch (err) {
      console.error(err);
      setErrorMsg("Une erreur est survenue. Réessayez.");
      setState("error");
    }
  }

  return (
    <div style={{ background: IVORY, color: MARINE }} className="min-h-screen font-sans antialiased">
      <style>{`
        @keyframes wave {
          0%,100% { height: 8px; }
          50% { height: 24px; }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes arrowSlide {
          0%,100% { transform: translateX(-8px); opacity: 0.6; }
          50% { transform: translateX(4px); opacity: 1; }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          to { opacity: 1; }
        }
      `}</style>

      {/* NAV */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-md border-b"
        style={{ background: "rgba(247,246,243,0.85)", borderColor: "rgba(13,27,42,0.06)" }}
      >
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <a
            href="/"
            className="text-[24px] italic font-normal"
            style={{ fontFamily: "'Instrument Serif', serif", color: MARINE }}
          >
            Ekko
          </a>
          <button
            onClick={() => scrollToId("early-access")}
            className="px-5 py-2.5 rounded-full text-[14px] font-semibold transition-transform duration-200 hover:scale-[1.02]"
            style={{ background: GREEN, color: MARINE }}
          >
            Rejoindre le pilote
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="px-5 md:px-8 pt-14 md:pt-24 pb-20">
        <div className="max-w-[1200px] mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-[12px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: GREEN, letterSpacing: "0.14em" }}
          >
            Pour les AE qui vendent en cycle long
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mt-4 font-bold"
            style={{
              fontSize: "clamp(44px, 7vw, 72px)",
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              color: MARINE,
            }}
          >
            Votre voix.
            <br />
            Leurs assets de vente.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-6 mx-auto"
            style={{
              maxWidth: 540,
              fontSize: "clamp(17px, 1.4vw, 20px)",
              lineHeight: 1.4,
              color: "rgba(13,27,42,0.65)",
            }}
          >
            Vous parlez 30 secondes. Ekko produit une vidéo perso, un booklet exec ou un atelier ROI.
            En 5 minutes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-10 flex items-center justify-center gap-3 flex-wrap"
          >
            <button
              onClick={() => scrollToId("early-access")}
              className="px-8 py-3.5 rounded-full text-[16px] font-semibold transition-all duration-200 hover:scale-[1.02] hover:brightness-105"
              style={{ background: GREEN, color: MARINE }}
            >
              Rejoindre le pilote
            </button>
            <button
              onClick={() => scrollToId("for-who")}
              className="px-4 py-3.5 text-[14px] underline underline-offset-4"
              style={{ color: "rgba(13,27,42,0.7)" }}
            >
              Voir une démo
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-20"
          >
            <HeroVisual />
            <p className="mt-6 text-[13px]" style={{ color: "rgba(13,27,42,0.5)" }}>
              Aussi : booklet exec, atelier ROI, intervention exec, suivi engagement.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 — POUR QUI */}
      <section id="for-who" style={{ background: MARINE }} className="px-5 md:px-8 py-24 md:py-32">
        <div className="max-w-[1200px] mx-auto text-center">
          <p
            className="text-[12px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: GREEN }}
          >
            Pour qui
          </p>
          <h2
            className="mt-4 font-bold"
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: IVORY,
            }}
          >
            Trois rôles.
            <br />
            Un seul outil.
          </h2>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                tag: "AE",
                title: "Account Executive",
                text: "Vous voulez personnaliser chaque deal sans y passer vos soirées.",
              },
              {
                tag: "VP",
                title: "VP Sales / CRO",
                text: "Vous voulez que vos AE moyens vendent comme vos top performers.",
              },
              {
                tag: "EXEC",
                title: "Dirigeants",
                text: "Vous voulez être présent sur chaque deal sans bloquer votre agenda.",
              },
            ].map((c, i) => (
              <motion.div
                key={c.tag}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-left p-8 rounded-2xl border transition-colors duration-200 hover:border-[#1AE08A]/60"
                style={{
                  background: "rgba(247,246,243,0.05)",
                  borderColor: "rgba(247,246,243,0.08)",
                }}
              >
                <span
                  className="inline-block text-[10px] font-semibold tracking-[0.2em] px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(26,224,138,0.15)", color: GREEN }}
                >
                  {c.tag}
                </span>
                <h3
                  className="mt-4 font-bold text-[22px]"
                  style={{ color: IVORY, letterSpacing: "-0.01em" }}
                >
                  {c.title}
                </h3>
                <p
                  className="mt-2 text-[14px] leading-relaxed"
                  style={{ color: "rgba(247,246,243,0.6)" }}
                >
                  {c.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3 — INSCRIPTION + FOUNDER */}
      <section
        id="early-access"
        className="px-5 md:px-8 py-24 md:py-32"
        style={{ background: "linear-gradient(180deg, #F7F6F3 0%, rgba(26,224,138,0.12) 100%)" }}
      >
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-12 md:gap-16 items-start">
          {/* LEFT — FOUNDER */}
          <div>
            <div
              className="w-[100px] h-[100px] rounded-full flex items-center justify-center text-[28px] font-bold"
              style={{
                background: MARINE,
                color: IVORY,
                fontFamily: "'Instrument Serif', serif",
              }}
            >
              JC
            </div>
            <p
              className="mt-6 text-[12px] font-semibold tracking-[0.14em] uppercase"
              style={{ color: GREEN }}
            >
              Founder
            </p>
            <h3
              className="mt-3 font-bold"
              style={{ fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.02em", color: MARINE }}
            >
              Je l'ai fait.
              <br />
              Je construis l'outil.
            </h3>
            <div
              className="mt-6 space-y-4 text-[15px] leading-relaxed"
              style={{ color: "rgba(13,27,42,0.72)" }}
            >
              <p>Pendant des années, AE en cycle long.</p>
              <p>
                Vidéo perso, booklet, atelier ROI sur chaque gros deal. Ça m'a fait gagner ce que mes
                collègues perdaient.
              </p>
              <p>Ekko, c'est cet outil. En 5 minutes au lieu de 2h.</p>
            </div>
            <p className="mt-6 font-bold text-[14px]" style={{ color: MARINE }}>
              Julien · founder
            </p>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[13px] underline underline-offset-4"
              style={{ color: "rgba(13,27,42,0.6)" }}
            >
              Me parler 20 min →
            </a>
          </div>

          {/* RIGHT — FORM */}
          <div
            className="rounded-[20px] p-8 md:p-9"
            style={{
              background: "#fff",
              boxShadow: "0 10px 40px -10px rgba(13,27,42,0.12)",
            }}
          >
            {state === "success" ? (
              <div className="text-center py-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: GREEN }}
                >
                  <Check size={32} color={IVORY} strokeWidth={3} />
                </motion.div>
                <h3
                  className="mt-6 font-bold text-[26px]"
                  style={{ color: MARINE, letterSpacing: "-0.01em" }}
                >
                  C'est noté, {form.prenom}.
                </h3>
                <p className="mt-2 text-[14px]" style={{ color: "rgba(13,27,42,0.6)" }}>
                  On vous écrit quand c'est prêt.
                </p>
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-block text-[14px] font-semibold underline underline-offset-4"
                  style={{ color: MARINE }}
                >
                  Réserver 20 min avec moi →
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <p
                  className="text-[12px] font-semibold tracking-[0.14em] uppercase"
                  style={{ color: GREEN }}
                >
                  Rejoindre le pilote
                </p>
                <h3
                  className="mt-3 font-bold"
                  style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.02em", color: MARINE }}
                >
                  20 AE. Juin 2026.
                  <br />
                  Vous en êtes ?
                </h3>
                <p className="mt-3 text-[14px]" style={{ color: "rgba(13,27,42,0.6)" }}>
                  Aucun engagement. 1 email quand on ouvre.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      required
                      placeholder="Prénom"
                      value={form.prenom}
                      onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                      className="h-11 px-3.5 rounded-[10px] border text-[14px] outline-none focus:border-[#0D1B2A] transition-colors"
                      style={{ borderColor: "rgba(13,27,42,0.15)", color: MARINE, background: "#fff" }}
                    />
                    <input
                      required
                      placeholder="Nom"
                      value={form.nom}
                      onChange={(e) => setForm({ ...form, nom: e.target.value })}
                      className="h-11 px-3.5 rounded-[10px] border text-[14px] outline-none focus:border-[#0D1B2A] transition-colors"
                      style={{ borderColor: "rgba(13,27,42,0.15)", color: MARINE, background: "#fff" }}
                    />
                  </div>
                  <input
                    required
                    type="email"
                    placeholder="marie@entreprise.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-[10px] border text-[14px] outline-none focus:border-[#0D1B2A] transition-colors"
                    style={{ borderColor: "rgba(13,27,42,0.15)", color: MARINE, background: "#fff" }}
                  />
                  <input
                    required
                    placeholder="Spendesk, Pigment..."
                    value={form.entreprise}
                    onChange={(e) => setForm({ ...form, entreprise: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-[10px] border text-[14px] outline-none focus:border-[#0D1B2A] transition-colors"
                    style={{ borderColor: "rgba(13,27,42,0.15)", color: MARINE, background: "#fff" }}
                  />
                  <select
                    required
                    value={form.poste}
                    onChange={(e) => setForm({ ...form, poste: e.target.value })}
                    className="w-full h-11 px-3 rounded-[10px] border text-[14px] outline-none focus:border-[#0D1B2A] transition-colors"
                    style={{ borderColor: "rgba(13,27,42,0.15)", color: form.poste ? MARINE : "rgba(13,27,42,0.4)", background: "#fff" }}
                  >
                    <option value="">Poste</option>
                    {POSTES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={state === "loading"}
                  className="mt-5 w-full h-12 rounded-[12px] font-bold text-[15px] transition-all duration-200 hover:scale-[1.01] hover:brightness-105 disabled:opacity-70 flex items-center justify-center gap-2"
                  style={{ background: GREEN, color: MARINE }}
                >
                  {state === "loading" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    "Je veux être prévenu"
                  )}
                </button>

                {state === "error" && errorMsg && (
                  <p className="mt-3 text-[13px] text-center" style={{ color: "#C0392B" }}>
                    {errorMsg}
                  </p>
                )}

                <p className="mt-3 text-[12px] text-center" style={{ color: "rgba(13,27,42,0.5)" }}>
                  Pas de spam. Promis.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: MARINE }} className="px-5 md:px-8 py-12">
        <div className="max-w-[1200px] mx-auto text-center">
          <div
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px]"
            style={{ color: "rgba(247,246,243,0.6)" }}
          >
            <span
              className="text-[18px] italic"
              style={{ fontFamily: "'Instrument Serif', serif", color: IVORY }}
            >
              Ekko
            </span>
            <span>·</span>
            <a href="#" className="hover:text-[#F7F6F3] transition-colors">Mentions</a>
            <span>·</span>
            <a href="#" className="hover:text-[#F7F6F3] transition-colors">Confidentialité</a>
            <span>·</span>
            <a href="#" className="hover:text-[#F7F6F3] transition-colors">CGU</a>
            <span>·</span>
            <a href="mailto:julien@getekko.eu" className="hover:text-[#F7F6F3] transition-colors">
              julien@getekko.eu
            </a>
          </div>
          <p className="mt-3 text-[12px]" style={{ color: "rgba(247,246,243,0.4)" }}>
            © 2026 Ekko · Paris
          </p>
        </div>
      </footer>
    </div>
  );
}
