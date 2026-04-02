import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { WaitlistDialog } from "@/components/WaitlistDialog";
import { EkkoLogo } from "@/components/ui/EkkoLogo";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ShieldAlert,
  Users,
  ArrowRight,
  Eye,
  CheckCircle2,
  FileText,
  CheckSquare,
  Send,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistSource, setWaitlistSource] = useState("landing");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b h-16 flex items-center px-6">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <EkkoLogo size={32} textSize={22} onDark={false} />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/auth")}>Connexion</Button>
            <Button className="rounded-full bg-primary text-accent font-semibold px-6" onClick={() => { setWaitlistSource("nav"); setWaitlistOpen(true); }}>Demander une démo</Button>
          </div>
        </div>
      </nav>

      {/* ── SECTION 1 — HERO ── */}
      <motion.section className="py-24 lg:py-32 px-6" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-5">Deal Intelligence · Buying Committee</p>
            <h1 className="text-5xl font-bold tracking-tight leading-[1.08] mb-5">
              Votre pipeline vous rassure.
              <br />
              Vos deals racontent <span className="text-muted-foreground">autre chose.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
              Ekko révèle <strong className="text-foreground font-semibold">qui avance, qui hésite et où ça ralentit</strong> pour agir avant que le deal ne vous échappe.
            </p>
            <div className="flex gap-3">
              <Button size="lg" className="rounded-full bg-primary text-accent font-semibold px-8" onClick={() => { setWaitlistSource("hero"); setWaitlistOpen(true); }}>
                Demander une démo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
                Voir comment ça fonctionne
              </Button>
            </div>
          </div>

          <FadeIn delay={0.2}>
            <div className="bg-primary rounded-2xl p-5 border border-sidebar-border shadow-2xl">
              <p className="text-[10px] text-primary-foreground/30 uppercase tracking-widest font-semibold mb-4">
                Deals — triés par urgence
              </p>
              <div className="bg-sidebar-accent rounded-lg p-3 mb-2 border-l-4 border-destructive flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary-foreground truncate">TotalEnergies — RFP Q2</p>
                  <p className="text-[11px] text-primary-foreground/40">CFO · 12j sans signal · 1 rôle clé manquant</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-bold bg-destructive/20 text-destructive px-2 py-0.5 rounded">À traiter</span>
                  <span className="text-xs font-bold text-destructive">54</span>
                </div>
              </div>
              <div className="bg-sidebar-accent rounded-lg p-3 mb-2 border-l-4 border-warning flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary-foreground truncate">Schneider Electric — ERP</p>
                  <p className="text-[11px] text-primary-foreground/40">3 nouveaux contacts détectés</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-bold bg-warning/20 text-warning px-2 py-0.5 rounded">À surveiller</span>
                  <span className="text-xs font-bold text-warning">71</span>
                </div>
              </div>
              <div className="bg-sidebar-accent rounded-lg p-3 mb-4 border-l-4 border-accent flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary-foreground truncate">Airbus — Transformation SI</p>
                  <p className="text-[11px] text-primary-foreground/40">2 sponsors actifs · Momentum en hausse</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-bold bg-accent/20 text-accent px-2 py-0.5 rounded">Sain</span>
                  <span className="text-xs font-bold text-accent">87</span>
                </div>
              </div>
              <div className="border border-accent/40 rounded-xl p-3 bg-sidebar">
                <p className="text-[9px] font-bold text-accent uppercase tracking-wider mb-1.5">
                  Action prioritaire · Urgence haute
                </p>
                <p className="text-xs font-medium text-primary-foreground mb-1">
                  Relancer le CFO TotalEnergies dans les 24h
                </p>
                <p className="text-[10px] text-primary-foreground/40">
                  Impact élevé · Confiance 82%
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </motion.section>

      {/* ── SECTION 2 — 3 SCÈNES POLITIQUES ── */}
      <motion.section className="py-16 bg-muted/20 border-y border-border/50 px-6" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
          {[
            {
              icon: AlertTriangle,
              iconBg: "bg-info/10",
              iconColor: "text-info",
              title: "Votre champion vous dit que ça avance.\nIl n'a rien ouvert depuis 12 jours.",
              badge: "Contradiction détectée.",
              badgeColor: "text-destructive",
            },
            {
              icon: Users,
              iconBg: "bg-accent/10",
              iconColor: "text-accent",
              title: "Trois personnes que vous ne connaissez pas\nviennent de voir votre message en interne.",
              badge: "Nouveaux décideurs identifiés.",
              badgeColor: "text-accent",
            },
            {
              icon: ShieldAlert,
              iconBg: "bg-destructive/10",
              iconColor: "text-destructive",
              title: "Tout le monde a regardé.\nSauf une personne. Le DSI.",
              badge: "Bloqueur potentiel.",
              badgeColor: "text-warning",
            },
          ].map((s, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="bg-card border border-border/60 rounded-xl p-7 h-full">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-5 ${s.iconBg}`}>
                  <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug mb-4 whitespace-pre-line">{s.title}</p>
                <p className={`text-xs font-bold ${s.badgeColor}`}>{s.badge}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </motion.section>

      {/* ── SECTION 3 — BUYING COMMITTEE ── */}
      <motion.section className="py-24 bg-background border-y border-border px-6" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <div className="max-w-[1100px] mx-auto">
          <p className="text-xs uppercase text-muted-foreground tracking-widest text-center mb-4">Buying Committee</p>
          <h2 className="text-4xl font-bold text-center tracking-tight mb-4">Savoir qui décide vraiment.</h2>
          <p className="text-lg text-muted-foreground text-center max-w-xl mx-auto mb-16">
            Chaque deal a une carte politique.
            <br />
            La plupart des équipes ne voient que la surface.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Sophie Renard */}
            <div className="bg-accent/5 border-2 border-accent rounded-xl p-4">
              <div className="bg-accent/20 text-accent rounded-full w-9 h-9 text-xs font-bold flex items-center justify-center mb-3">SR</div>
              <p className="text-sm font-semibold">Sophie Renard</p>
              <p className="text-xs text-muted-foreground mb-3">DRH · TotalEnergies</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: "92%" }} /></div>
              <span className="inline-block text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full mt-2">Sponsor actif</span>
            </div>

            {/* Marc Duval */}
            <div className="bg-accent/5 border border-accent/40 rounded-xl p-4">
              <div className="bg-accent/20 text-accent rounded-full w-9 h-9 text-xs font-bold flex items-center justify-center mb-3">MD</div>
              <p className="text-sm font-semibold">Marc Duval</p>
              <p className="text-xs text-muted-foreground mb-3">COO · TotalEnergies</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: "78%" }} /></div>
              <span className="inline-block text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full mt-2">Sponsor actif</span>
            </div>

            {/* Pierre Blanc */}
            <div className="bg-warning/5 border border-warning/40 rounded-xl p-4">
              <div className="bg-warning/20 text-warning rounded-full w-9 h-9 text-xs font-bold flex items-center justify-center mb-3">PB</div>
              <p className="text-sm font-semibold">Pierre Blanc</p>
              <p className="text-xs text-muted-foreground mb-3">CFO · TotalEnergies</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-warning rounded-full" style={{ width: "38%" }} /></div>
              <span className="inline-block text-[10px] font-semibold bg-warning/10 text-warning px-2 py-0.5 rounded-full mt-2">À réactiver</span>
            </div>

            {/* Thomas Girard */}
            <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-4">
              <div className="bg-destructive/20 text-destructive rounded-full w-9 h-9 text-xs font-bold flex items-center justify-center mb-3">TG</div>
              <p className="text-sm font-semibold">Thomas Girard</p>
              <p className="text-xs text-muted-foreground mb-3">DSI · TotalEnergies</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-destructive rounded-full" style={{ width: "18%" }} /></div>
              <span className="inline-block text-[10px] font-semibold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full mt-2">Bloqueur potentiel</span>
            </div>

            {/* Non identifié */}
            <div className="bg-muted/50 border border-dashed border-border rounded-xl p-4">
              <div className="border-dashed border-2 border-muted-foreground/30 text-muted-foreground/40 rounded-full w-9 h-9 text-xs font-bold flex items-center justify-center mb-3">?</div>
              <p className="text-sm font-semibold text-muted-foreground">Non identifié</p>
              <p className="text-xs text-muted-foreground mb-3">totalenergies.com</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-muted-foreground/30 rounded-full" style={{ width: "52%" }} /></div>
              <span className="inline-block text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full mt-2">À identifier</span>
            </div>
          </div>

          {/* Légende */}
          <div className="flex gap-6 justify-center mt-8 flex-wrap">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent" /><span className="text-xs text-muted-foreground">Sponsor actif</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" /><span className="text-xs text-muted-foreground">À réactiver</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" /><span className="text-xs text-muted-foreground">Bloqueur potentiel</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border border-dashed border-muted-foreground" /><span className="text-xs text-muted-foreground">À identifier</span></div>
          </div>
        </div>
      </motion.section>

      {/* ── SECTION — LE PRODUIT EN ACTION ── */}
      <FadeIn>
        <section className="py-20 bg-primary">
          <div className="container mx-auto px-4">
            <p className="text-[11px] font-semibold text-primary-foreground/30 uppercase tracking-widest text-center mb-10">
              Le produit en action
            </p>
            <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-6">

              {/* Bloc gauche — liste des deals */}
              <div className="bg-sidebar rounded-2xl border border-sidebar-border overflow-hidden">
                <div className="px-5 py-4 border-b border-sidebar-border flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary-foreground">Deals actifs</p>
                  <p className="text-[10px] text-primary-foreground/30 uppercase tracking-widest">Triés par urgence</p>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { name: 'TotalEnergies — RFP Q2', meta: 'CFO silencieux depuis 12j · 1 bloqueur', badge: 'En danger', score: '54', border: 'border-destructive', tc: 'text-destructive', bg: 'bg-destructive/10' },
                    { name: 'Schneider Electric — ERP', meta: '3 nouveaux contacts détectés cette semaine', badge: 'À surveiller', score: '71', border: 'border-warning', tc: 'text-warning', bg: 'bg-warning/10' },
                    { name: 'Airbus — Transformation SI', meta: '2 sponsors actifs · Momentum en hausse', badge: 'Sain', score: '87', border: 'border-accent', tc: 'text-accent', bg: 'bg-accent/10' },
                  ].map(d => (
                    <div key={d.name} className={`bg-sidebar-accent rounded-xl p-4 border-l-4 ${d.border} flex items-center justify-between gap-4`}>
                      <div>
                        <p className="text-sm font-semibold text-primary-foreground mb-1">{d.name}</p>
                        <p className="text-xs text-primary-foreground/40">{d.meta}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-bold ${d.bg} ${d.tc} px-3 py-1 rounded-lg`}>{d.badge}</span>
                        <span className={`text-lg font-bold ${d.tc}`}>{d.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 border-t border-sidebar-border bg-sidebar">
                  <p className="text-[9px] font-bold text-accent uppercase tracking-wider mb-2">Action prioritaire · Urgence haute</p>
                  <p className="text-sm font-semibold text-primary-foreground mb-1">Relancer le CFO TotalEnergies dans les 24h</p>
                  <p className="text-xs text-primary-foreground/40">Impact élevé · Confiance 82%</p>
                </div>
              </div>

              {/* Bloc droit — buying committee */}
              <div className="bg-sidebar rounded-2xl border border-sidebar-border overflow-hidden">
                <div className="px-5 py-4 border-b border-sidebar-border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary-foreground">TotalEnergies — RFP Q2</p>
                    <p className="text-xs text-primary-foreground/30 mt-0.5">Buying committee · 5 contacts</p>
                  </div>
                  <span className="text-xs font-bold bg-destructive/10 text-destructive px-3 py-1 rounded-lg">En danger</span>
                </div>
                <div className="px-5 py-3 bg-destructive/5 border-b border-destructive/10 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0"></div>
                  <p className="text-xs text-destructive font-medium">CFO silencieux depuis 12 jours — action requise</p>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    { av: 'SR', name: 'Sophie Renard', role: 'DRH · TotalEnergies', pct: 92, badge: 'Sponsor actif', avc: 'bg-accent/20 text-accent', bc: 'bg-accent', bdg: 'text-accent bg-accent/10' },
                    { av: 'MD', name: 'Marc Duval', role: 'COO · TotalEnergies', pct: 78, badge: 'Sponsor actif', avc: 'bg-accent/20 text-accent', bc: 'bg-accent', bdg: 'text-accent bg-accent/10' },
                    { av: 'PB', name: 'Pierre Blanc', role: 'CFO · TotalEnergies', pct: 38, badge: 'À réactiver', avc: 'bg-warning/20 text-warning', bc: 'bg-warning', bdg: 'text-warning bg-warning/10' },
                    { av: 'TG', name: 'Thomas Girard', role: 'DSI · TotalEnergies', pct: 18, badge: 'Bloqueur', avc: 'bg-destructive/20 text-destructive', bc: 'bg-destructive', bdg: 'text-destructive bg-destructive/10' },
                    { av: '?', name: 'Non identifié', role: 'totalenergies.com', pct: 52, badge: 'À identifier', avc: 'border border-dashed border-sidebar-border text-primary-foreground/20', bc: 'bg-primary-foreground/10', bdg: 'text-primary-foreground/30 bg-sidebar-accent' },
                  ].map(c => (
                    <div key={c.name} className="flex items-center gap-3 py-1.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.avc}`}>{c.av}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary-foreground">{c.name}</p>
                        <p className="text-xs text-primary-foreground/30">{c.role}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="w-20 h-1.5 bg-sidebar-border rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${c.bc}`} style={{width: `${c.pct}%`}}></div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap ${c.bdg}`}>{c.badge}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>
      </FadeIn>

      {/* ── SECTION 4 — COMMENT ÇA MARCHE ── */}
      <motion.section id="how-it-works" className="py-24 bg-muted/30 px-6" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase text-muted-foreground tracking-widest text-center mb-4">Comment ça marche</p>
          <h2 className="text-4xl font-bold text-center tracking-tight mb-4">De l'envoi au signal en 4 étapes</h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-16">
            Chaque deal stratégique bénéficie d'une présence exécutive.
            <br />
            Chaque interaction révèle la carte politique de votre prospect.
          </p>

          <div className="grid md:grid-cols-4 gap-4">
            {[
              { num: "1", icon: FileText, title: "Vous ciblez un deal", text: "L'AE crée le deal. Script personnalisé pour le bon décideur en 30 secondes.", highlight: false },
              { num: "2", icon: CheckSquare, title: "Votre exec intervient", text: "L'exec approuve en un clic via email, Slack ou WhatsApp. Sans login.", highlight: false },
              { num: "3", icon: Send, title: "Le deal réagit", text: "Présence exécutive sur chaque deal stratégique au moment où elle compte.", highlight: false },
              { num: "4", icon: Eye, title: "La lecture politique", text: "Qui soutient, qui hésite, qui bloque.\nLa carte politique de votre deal en temps réel.", highlight: true },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 0.1}>
                <div className={`rounded-xl p-7 text-center h-full ${step.highlight ? "bg-accent/5 border-2 border-accent" : "bg-card border"}`}>
                  <div className={`w-10 h-10 rounded-full font-bold text-base flex items-center justify-center mx-auto mb-5 ${step.highlight ? "bg-accent text-primary" : "bg-primary text-accent"}`}>
                    {step.num}
                  </div>
                  <step.icon className={`h-7 w-7 mx-auto mb-4 ${step.highlight ? "text-accent" : "text-muted-foreground"}`} />
                  <p className="text-sm font-semibold mb-2">{step.title}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{step.text}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── SECTION 5 — POUR QUI ── */}
      <motion.section className="py-24 bg-primary text-primary-foreground px-6" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase text-primary-foreground/30 tracking-widest text-center mb-4">Pour qui</p>
          <h2 className="text-4xl font-bold text-center tracking-tight mb-16">Fait pour les équipes enterprise en cycle long</h2>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Card 1 — featured */}
            <div className="border-2 border-accent bg-sidebar-accent rounded-xl p-8">
              <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />Utilisateur quotidien
              </p>
              <h3 className="text-xl font-semibold text-primary-foreground mb-6">Account Executives — cycles longs</h3>
              <ul className="space-y-3">
                {["Voir la réalité du deal avant le prochain call", "Savoir qui influencer, quand et comment", "Ne plus perdre un deal sans comprendre pourquoi"].map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-primary-foreground/80">
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />{t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2 */}
            <div className="border border-sidebar-border bg-sidebar rounded-xl p-8">
              <p className="text-[10px] font-bold text-primary-foreground/30 uppercase tracking-wider mb-4">Acheteur</p>
              <h3 className="text-xl font-semibold text-primary-foreground mb-6">VP Sales & CRO</h3>
              <ul className="space-y-3">
                {["Détecter les deals à risque avant qu'ils tombent", "Fiabiliser les prévisions", "Baser le pipeline sur des signaux réels, pas déclaratifs"].map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-primary-foreground/80">
                    <CheckCircle2 className="h-4 w-4 text-primary-foreground/40 shrink-0 mt-0.5" />{t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 3 */}
            <div className="border border-sidebar-border bg-sidebar rounded-xl p-8">
              <p className="text-[10px] font-bold text-primary-foreground/30 uppercase tracking-wider mb-4">Exec clone</p>
              <h3 className="text-xl font-semibold text-primary-foreground mb-6">Dirigeants & Executives</h3>
              <ul className="space-y-3">
                {["Être présent sur chaque deal sans bloquer l'agenda", "Garder le contrôle total sur son image", "Comprendre l'impact réel de chaque intervention"].map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-primary-foreground/80">
                    <CheckCircle2 className="h-4 w-4 text-primary-foreground/40 shrink-0 mt-0.5" />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── SECTION 6 — CTA FINAL ── */}
      <motion.section className="py-24 bg-accent px-6" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <div className="max-w-[600px] mx-auto text-center">
          <h2 className="text-4xl font-bold tracking-tight text-primary mb-4">
            Arrêtez de deviner ce qui se passe dans vos deals.
            <br />
            Commencez à le voir.
          </h2>
          <p className="text-lg text-primary/70 mb-10">
            Rejoignez les équipes qui savent ce qui se passe avant leur prochain call.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="rounded-full bg-primary text-accent font-semibold px-8" onClick={() => { setWaitlistSource("cta"); setWaitlistOpen(true); }}>
              Demander une démo <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" className="rounded-full bg-transparent border border-primary/20 text-primary px-8" onClick={() => { setWaitlistSource("inscription"); setWaitlistOpen(true); }}>
              Inscription
            </Button>
          </div>
        </div>
      </motion.section>

      {/* ── FOOTER ── */}
      <footer className="py-12 bg-primary border-t border-primary-foreground/10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <EkkoLogo size={24} textSize={18} onDark={true} />
            <p className="text-sm text-primary-foreground/30 mt-2">Deal Intelligence · Buying Committee Signal · Exec Presence</p>
          </div>

          <div className="grid grid-cols-3 gap-8 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-primary-foreground/60 mb-3">Produit</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground transition-colors cursor-pointer">Fonctionnalités</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground transition-colors cursor-pointer">Tarifs</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground transition-colors cursor-pointer">Sécurité</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-primary-foreground/60 mb-3">Ressources</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground transition-colors cursor-pointer">Documentation</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground transition-colors cursor-pointer">Blog</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground transition-colors cursor-pointer">Changelog</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-primary-foreground/60 mb-3">Légal</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground transition-colors cursor-pointer">Mentions légales</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground transition-colors cursor-pointer">Confidentialité</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground transition-colors cursor-pointer">CGU</p>
            </div>
          </div>

          <p className="text-sm text-primary-foreground/30">© 2026 Ekko.</p>
        </div>

        <div className="max-w-5xl mx-auto border-t border-primary-foreground/10 mt-8 pt-8 text-center text-xs text-primary-foreground/20">
          © 2026 Ekko. Tous droits réservés.
        </div>
      </footer>

      <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} source={waitlistSource} />
    </div>
  );
}
