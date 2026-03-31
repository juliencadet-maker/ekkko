import { useNavigate } from "react-router-dom";
import { EkkoLogo } from "@/components/ui/EkkoLogo";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Share2,
  ShieldAlert,
  Users,
  Zap,
  ArrowRight,
  Eye,
  CheckCircle2,
  FileText,
  CheckSquare,
  Send,
  Building2,
  Briefcase,
  TrendingUp,
} from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  const scrollToHow = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b h-16 flex items-center px-6">
        <div className="max-w-[1140px] mx-auto w-full flex items-center justify-between">
          <EkkoLogo size={32} textSize={22} onDark={false} />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/auth")}>Connexion</Button>
            <Button className="rounded-full bg-primary text-accent font-semibold px-5 hidden sm:inline-flex" onClick={() => navigate("/auth")}>Demander une démo</Button>
          </div>
        </div>
      </nav>

      {/* ── SECTION 1 — HERO ── */}
      <section className="py-24 lg:py-32 px-6">
        <div className="max-w-[1140px] mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-5">Deal Intelligence · Buying Committee</p>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
              Votre pipeline vous rassure.
              <br />
              Vos deals racontent <span className="text-muted-foreground">autre chose.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
              Ekko révèle <span className="font-semibold text-foreground">qui soutient, qui hésite et qui bloque</span> pour agir au bon moment sur chaque deal.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="rounded-full bg-primary text-accent font-semibold px-8" onClick={() => navigate("/auth")}>
                Demander une démo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8" onClick={scrollToHow}>
                Voir comment ça fonctionne
              </Button>
            </div>
          </div>

          <img src="/screenshots/deals-list.png" alt="Ekko — Liste des deals triés par urgence" className="rounded-2xl shadow-2xl w-full" />
        </div>
      </section>

      {/* ── SECTION 2 — 3 SCÈNES POLITIQUES ── */}
      <section className="py-16 bg-muted/20 border-y border-border/50 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
          {[
            {
              icon: AlertTriangle,
              iconBg: "bg-info/10",
              iconColor: "text-info",
              title: "Votre champion vous dit que ça avance. Il n'a rien ouvert depuis 12 jours.",
              text: "Ekko détecte la contradiction et vous alerte.",
              badge: "Contradiction détectée",
              badgeColor: "text-destructive",
            },
            {
              icon: Users,
              iconBg: "bg-accent/10",
              iconColor: "text-accent",
              title: "Trois personnes que vous ne connaissez pas viennent de voir votre message en interne.",
              text: "Ekko les identifie et vous dit qui approcher en premier.",
              badge: "3 contacts identifiés",
              badgeColor: "text-accent",
            },
            {
              icon: ShieldAlert,
              iconBg: "bg-destructive/10",
              iconColor: "text-destructive",
              title: "Tout le monde a regardé. Sauf une personne. Le DSI.",
              text: "Ekko repère le risque et vous dit quoi faire avant le veto.",
              badge: "Bloqueur potentiel",
              badgeColor: "text-warning",
            },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-border/60 rounded-xl p-6">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${s.iconBg}`}>
                <s.icon className={`h-5 w-5 ${s.iconColor}`} />
              </div>
              <p className="font-bold text-sm mb-2">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.text}</p>
              <p className={`text-xs font-semibold ${s.badgeColor} mt-3`}>{s.badge}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 3 — BUYING COMMITTEE ── */}
      <section className="py-24 bg-background border-y border-border px-6">
        <div className="max-w-[1100px] mx-auto">
          <p className="text-xs uppercase text-muted-foreground tracking-widest text-center mb-4">Buying Committee</p>
          <h2 className="text-4xl font-bold text-center tracking-tight mb-4">Savoir qui décide vraiment.</h2>
          <p className="text-lg text-muted-foreground text-center max-w-xl mx-auto mb-16">
            Chaque deal a une carte politique. La plupart des AEs n'en voient que la surface. Ekko la révèle en temps réel.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-accent/5 border-2 border-accent rounded-xl p-4">
              <div className="bg-accent/20 text-accent rounded-full w-9 h-9 text-xs font-bold flex items-center justify-center mb-3">SR</div>
              <p className="text-sm font-semibold">Sophie Renard</p>
              <p className="text-xs text-muted-foreground mb-3">DRH · TotalEnergies</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: "92%" }} /></div>
              <span className="inline-block text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full mt-2">Sponsor actif</span>
            </div>

            <div className="bg-accent/5 border-2 border-accent rounded-xl p-4">
              <div className="bg-accent/20 text-accent rounded-full w-9 h-9 text-xs font-bold flex items-center justify-center mb-3">MD</div>
              <p className="text-sm font-semibold">Marc Duval</p>
              <p className="text-xs text-muted-foreground mb-3">COO · TotalEnergies</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: "78%" }} /></div>
              <span className="inline-block text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full mt-2">Sponsor actif</span>
            </div>

            <div className="bg-warning/5 border border-warning/40 rounded-xl p-4">
              <div className="bg-warning/20 text-warning rounded-full w-9 h-9 text-xs font-bold flex items-center justify-center mb-3">PB</div>
              <p className="text-sm font-semibold">Pierre Blanc</p>
              <p className="text-xs text-muted-foreground mb-3">CFO · TotalEnergies</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-warning rounded-full" style={{ width: "38%" }} /></div>
              <span className="inline-block text-[10px] font-semibold bg-warning/10 text-warning px-2 py-0.5 rounded-full mt-2">À réactiver</span>
            </div>

            <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-4">
              <div className="bg-destructive/20 text-destructive rounded-full w-9 h-9 text-xs font-bold flex items-center justify-center mb-3">TG</div>
              <p className="text-sm font-semibold">Thomas Girard</p>
              <p className="text-xs text-muted-foreground mb-3">DSI · TotalEnergies</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-destructive rounded-full" style={{ width: "18%" }} /></div>
              <span className="inline-block text-[10px] font-semibold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full mt-2">Bloqueur potentiel</span>
            </div>

            <div className="bg-muted/50 border border-dashed border-border rounded-xl p-4">
              <div className="border-dashed border-2 border-muted-foreground/30 text-muted-foreground rounded-full w-9 h-9 text-xs font-bold flex items-center justify-center mb-3">?</div>
              <p className="text-sm font-semibold text-muted-foreground">Non identifié</p>
              <p className="text-xs text-muted-foreground mb-3">totalenergies.com</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-muted-foreground/40 rounded-full" style={{ width: "52%" }} /></div>
              <span className="inline-block text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full mt-2">À identifier</span>
            </div>
          </div>

          <div className="flex gap-6 justify-center mt-8 flex-wrap">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent" /><span className="text-xs text-muted-foreground">Sponsor actif</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" /><span className="text-xs text-muted-foreground">À réactiver</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" /><span className="text-xs text-muted-foreground">Bloqueur potentiel</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border border-dashed border-muted-foreground" /><span className="text-xs text-muted-foreground">À identifier</span></div>
          </div>
        </div>
      </section>

      {/* ── SECTION SCREENSHOTS ── */}
      <section className="py-16 bg-muted/20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          <div>
            <img src="/screenshots/buying-committee-demo.png" alt="Carte politique du deal" className="rounded-xl w-full" />
            <p className="text-sm text-muted-foreground text-center mt-3">Carte politique du deal en temps réel</p>
          </div>
          <div>
            <img src="/screenshots/deal-mission-control.png" alt="Mission control — NBA et alertes" className="rounded-xl w-full" />
            <p className="text-sm text-muted-foreground text-center mt-3">Mission control — NBA et alertes actives</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 bg-muted/30 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase text-muted-foreground tracking-widest text-center mb-4">Comment ça fonctionne</p>
          <h2 className="text-4xl font-bold text-center tracking-tight mb-4">De zéro à signal en 4 étapes</h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-16">
            Chaque deal stratégique bénéficie d'une présence exécutive. Chaque interaction devient un signal sur votre buying committee.
          </p>

          <div className="grid md:grid-cols-4 gap-4">
            {[
              { num: "1", icon: FileText, title: "Le deal", text: "L'AE crée le deal. Ekko génère un script personnalisé pour le bon décideur en 30 secondes.", highlight: false },
              { num: "2", icon: CheckSquare, title: "L'approbation", text: "L'exec approuve en un clic via email, Slack ou WhatsApp. Sans login.", highlight: false },
              { num: "3", icon: Send, title: "La présence", text: "Chaque deal stratégique bénéficie d'une présence exécutive. L'exec engage le prospect sans réunion.", highlight: false },
              { num: "4", icon: Eye, title: "La lecture politique", text: "Qui soutient, qui hésite, qui bloque. La carte politique de votre deal se révèle en temps réel.", highlight: true },
            ].map((step) => (
              <div key={step.num} className={`rounded-xl p-7 text-center ${step.highlight ? "bg-accent/5 border-2 border-accent" : "bg-card border"}`}>
                <div className={`w-10 h-10 rounded-full font-bold text-base flex items-center justify-center mx-auto mb-5 ${step.highlight ? "bg-accent text-primary" : "bg-primary text-accent"}`}>
                  {step.num}
                </div>
                <step.icon className={`h-7 w-7 mx-auto mb-4 ${step.highlight ? "text-accent" : "text-muted-foreground"}`} />
                <p className="text-base font-semibold mb-3">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5 — POUR QUI ── */}
      <section className="py-24 bg-primary text-primary-foreground px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase text-primary-foreground/30 tracking-widest text-center mb-4">Pour qui</p>
          <h2 className="text-4xl font-bold text-center tracking-tight mb-16">Fait pour les équipes enterprise en cycle long</h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="border-2 border-accent bg-sidebar-accent rounded-xl p-8">
              <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />Utilisateur quotidien
              </p>
              <h3 className="text-xl font-semibold text-primary-foreground mb-6">Account Executives — cycles longs</h3>
              <ul className="space-y-3">
                {["Lire la carte politique de chaque deal sans attendre le prochain appel", "Se différencier avec une présence exécutive sur chaque RFP et chaque deal critique", "Ne plus jamais perdre un deal sans comprendre ce qui s'est vraiment passé"].map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-primary-foreground/80">
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />{t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-sidebar-border bg-sidebar rounded-xl p-8">
              <p className="text-[10px] font-bold text-primary-foreground/40 uppercase tracking-wider mb-4">Acheteur</p>
              <h3 className="text-xl font-semibold text-primary-foreground mb-6">VP Sales & CRO</h3>
              <ul className="space-y-3">
                {["Un pipeline prévisible basé sur les signaux réels et non sur les déclarations", "Présence exécutive sur 100% des deals stratégiques sans multiplier les réunions", "Identifier les deals à risque avant qu'ils disparaissent du pipeline"].map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-primary-foreground/70">
                    <CheckCircle2 className="h-4 w-4 text-primary-foreground/50 shrink-0 mt-0.5" />{t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-sidebar-border bg-sidebar rounded-xl p-8">
              <p className="text-[10px] font-bold text-primary-foreground/40 uppercase tracking-wider mb-4">Exec clone</p>
              <h3 className="text-xl font-semibold text-primary-foreground mb-6">Dirigeants & Executives</h3>
              <ul className="space-y-3">
                {["Chaque deal stratégique bénéficie de votre présence sans mobiliser votre agenda", "Contrôle total sur votre image — vous approuvez chaque script avant envoi", "Voir comment votre message a été reçu dans le comité de décision"].map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-primary-foreground/70">
                    <CheckCircle2 className="h-4 w-4 text-primary-foreground/50 shrink-0 mt-0.5" />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6 — CTA FINAL ── */}
      <section className="py-24 bg-accent text-accent-foreground px-6">
        <div className="max-w-[600px] mx-auto text-center">
          <h2 className="text-4xl font-bold tracking-tight text-primary mb-4">Vos deals méritent une lecture politique.</h2>
          <p className="text-lg text-primary/70 mb-10">Arrêtez de deviner ce qui se passe côté prospect. Ekko vous le montre.</p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="bg-primary text-accent rounded-full px-8 font-semibold" onClick={() => navigate("/auth")}>
              Demander une démo <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" className="bg-transparent border border-primary/20 text-primary rounded-full px-8" onClick={() => navigate("/auth")}>
              Inscription
            </Button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 border-t bg-primary text-primary-foreground px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <EkkoLogo size={24} textSize={18} onDark={true} />
            <p className="text-sm text-primary-foreground/30 mt-2">Deal Intelligence · Buying Committee Signal · Exec Presence</p>
          </div>

          <div className="grid grid-cols-3 gap-12 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-primary-foreground/60 mb-3">Produit</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground cursor-pointer">Fonctionnalités</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground cursor-pointer">Tarifs</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground cursor-pointer">Sécurité</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-primary-foreground/60 mb-3">Ressources</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground cursor-pointer">Documentation</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground cursor-pointer">Blog</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground cursor-pointer">Changelog</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-primary-foreground/60 mb-3">Légal</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground cursor-pointer">Mentions légales</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground cursor-pointer">Confidentialité</p>
              <p className="text-primary-foreground/40 hover:text-primary-foreground cursor-pointer">CGU</p>
            </div>
          </div>

          <p className="text-sm text-primary-foreground/30">© 2026 Ekko.</p>
        </div>

        <div className="max-w-5xl mx-auto border-t border-primary-foreground/10 mt-8 pt-8 text-center text-xs text-primary-foreground/20">
          © 2026 Ekko. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}
