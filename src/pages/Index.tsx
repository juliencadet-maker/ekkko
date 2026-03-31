import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EkkoLogo } from "@/components/ui/EkkoLogo";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowRight, 
  Shield, 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  CheckSquare, 
  Send, 
  Eye,
  Building2,
  Briefcase,
  Scale,
  TrendingUp,
  Target,
  Handshake,
  LineChart,
  BarChart3,
  Zap,
} from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EkkoLogo size={32} textSize={22} onDark={false} />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>Connexion</Button>
            <Button variant="outline" onClick={() => navigate("/auth")}>Inscription</Button>
            <Button onClick={() => navigate("/auth")}>
              Demander une démo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section — with product visual */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
                  Votre présence sur chaque deal.<br />
                  <span className="text-muted-foreground">Votre revenue sécurisé.</span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 leading-relaxed">
                  La vidéo exec personnalisée sur chaque deal critique. Approuvée en 1 clic. Mesurée en temps réel.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <Button size="lg" className="text-base px-8" onClick={() => navigate("/auth")}>
                    Demander une démo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button size="lg" variant="outline" className="text-base px-8">
                    Voir comment ça fonctionne
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Conçu pour les CRO, VP Sales et équipes commerciales en cycle de vente complexe.
                </p>
              </div>

              {/* Product visual — mock dashboard/powermap */}
              <div className="relative">
                <div className="bg-primary rounded-2xl p-6 shadow-2xl">
                  {/* Fake dashboard header */}
                  <div className="flex items-center gap-3 mb-4">
                    <EkkoLogo size={20} showText={false} onDark={true} />
                    <span className="ekko-logo-text text-primary-foreground text-sm">Deal Intelligence</span>
                  </div>
                  {/* Fake metrics row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-sidebar-accent rounded-lg p-3">
                      <p className="text-2xl font-bold text-accent">78</p>
                      <p className="text-[10px] text-primary-foreground/60">DES Score</p>
                    </div>
                    <div className="bg-sidebar-accent rounded-lg p-3">
                      <p className="text-2xl font-bold text-primary-foreground">5</p>
                      <p className="text-[10px] text-primary-foreground/60">Contacts actifs</p>
                    </div>
                    <div className="bg-sidebar-accent rounded-lg p-3">
                      <p className="text-2xl font-bold text-warning">2</p>
                      <p className="text-[10px] text-primary-foreground/60">Alertes</p>
                    </div>
                  </div>
                  {/* Fake buying committee */}
                  <div className="bg-sidebar-accent rounded-lg p-3">
                    <p className="text-[10px] text-primary-foreground/60 mb-2">Buying Committee</p>
                    <div className="flex items-center gap-2">
                      {["CEO", "CFO", "CTO", "VP"].map((role, i) => (
                        <div key={role} className="flex items-center gap-1.5">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold ${
                            i === 0 ? "bg-accent text-accent-foreground" : 
                            i === 1 ? "bg-accent/60 text-accent-foreground" : 
                            i === 2 ? "bg-warning/60 text-warning-foreground" :
                            "bg-muted text-muted-foreground"
                          }`}>{role[0]}</div>
                          <span className="text-[9px] text-primary-foreground/70">{role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-3 -right-3 bg-accent text-accent-foreground px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                  Signal en temps réel
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clarification Strip — with quantified benefits */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Sans Ekko */}
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <XCircle className="h-6 w-6 text-destructive" />
                  <h3 className="text-lg font-semibold">Sans Ekko</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    L'exec ne peut pas être sur tous les deals — les AE perdent en crédibilité
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    Les réponses RFP sont génériques, sans différenciation humaine
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    Aucune visibilité sur l'engagement réel des décideurs
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Avec Ekko — marine bg + signal accents, quantified */}
            <Card className="border-accent/30 bg-primary text-primary-foreground">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <CheckCircle2 className="h-6 w-6 text-accent" />
                  <h3 className="text-lg font-semibold text-primary-foreground">Avec Ekko</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-primary-foreground/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    Présence exec sur <span className="font-bold text-accent">100%</span> des deals stratégiques, 0 réunion en plus
                  </li>
                  <li className="flex items-start gap-3 text-primary-foreground/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    Signal d'engagement en <span className="font-bold text-accent">&lt;2 minutes</span> après chaque vue
                  </li>
                  <li className="flex items-start gap-3 text-primary-foreground/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    Observation du buying committee depuis l'intérieur du deal
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 leading-tight">
              Votre pipeline grossit.<br />
              <span className="text-muted-foreground">Votre présence ne scale pas.</span>
            </h2>
            <ul className="space-y-4 mb-8 text-lg text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-primary mt-2.5 shrink-0" />
                Vos AE manquent de crédibilité face aux C-levels sans sponsor exécutif
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-primary mt-2.5 shrink-0" />
                Les réponses RFP restent des documents froids sans différenciation
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-primary mt-2.5 shrink-0" />
                Les deals stagnent faute d'intimité et de confiance au bon moment
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-primary mt-2.5 shrink-0" />
                Vous ne savez pas quels deals ont vraiment reçu l'attention qu'ils méritent
              </li>
            </ul>
            <p className="text-xl font-semibold text-foreground">
              Résultat : un win ratio qui stagne et un revenue imprévisible.
            </p>
          </div>
        </div>
      </section>

      <Separator />

      {/* Solution Section — repositioned as deal copilot */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
              Le copilote qui observe le buying committee<br />
              <span className="text-muted-foreground">depuis l'intérieur de chaque deal.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Ekko n'est pas un outil vidéo. C'est le seul moyen d'observer qui regarde, 
              qui partage, qui hésite — et d'intervenir au bon moment pour closer.
            </p>
          </div>
        </div>
      </section>

      {/* Three Pillars Section — Revenue-first */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Présence exécutive à l'échelle</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Votre voix et votre image sur chaque deal critique. 
                  Les AE obtiennent un sponsor exécutif en vidéo personnalisée, 
                  sans mobiliser l'agenda du leadership.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Handshake className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Différenciation commerciale</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Réponses RFP, follow-ups stratégiques, executive sponsorship : 
                  chaque interaction devient personnalisée et mémorable. 
                  Vos commerciaux se démarquent à chaque étape.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <LineChart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Revenue prévisible</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Mesurez l'engagement des décideurs, identifiez les deals à risque 
                  et corrélez la présence exécutive avec le win ratio. 
                  Votre pipeline devient prévisible.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center">
              Comment ça fonctionne
            </h2>
            <div className="grid md:grid-cols-4 gap-8">
              {[
                {
                  step: 1,
                  icon: FileText,
                  title: "Le deal",
                  description: "Votre AE identifie un deal stratégique. Ekko génère un script personnalisé pour le décideur en 30 secondes."
                },
                {
                  step: 2,
                  icon: CheckSquare,
                  title: "La validation",
                  description: "L'exécutif approuve le message en un clic — via email, Slack ou WhatsApp. Aucun login requis."
                },
                {
                  step: 3,
                  icon: Send,
                  title: "La présence",
                  description: "Ekko génère et diffuse la vidéo personnalisée. L'exécutif est présent sur le deal sans être en réunion."
                },
                {
                  step: 4,
                  icon: Eye,
                  title: "L'impact",
                  description: "Qui a regardé ? Combien de temps ? Qui a partagé ? Ekko corrèle chaque vue avec l'avancement du deal. Signal en <2 minutes.",
                  highlight: true,
                }
              ].map((item) => (
                <div key={item.step} className={`text-center ${(item as any).highlight ? "relative" : ""}`}>
                  {(item as any).highlight && (
                    <div className="absolute -inset-3 bg-accent/5 rounded-2xl border border-accent/20" />
                  )}
                  <div className="relative">
                    <div className="relative mb-6">
                      <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto text-2xl font-bold">
                        {item.step}
                      </div>
                    </div>
                    <item.icon className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* For Who Section — AE first per audit */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center">
            Pour qui ?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* AE first — they are the daily user */}
            <Card className="border shadow-sm">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                  <Briefcase className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Équipes commerciales</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Se différencier dans les réponses RFP avec une vidéo exec personnalisée
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Obtenir un executive sponsorship instantané sur les deals clés
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Créer plus d'intimité et de confiance avec les décideurs
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* CRO second — buyer */}
            <Card className="border shadow-sm">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                  <TrendingUp className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-4">CRO / VP Sales</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Rendre le revenue prévisible et maîtrisé
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Déployer la présence exécutive comme levier de closing
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Mesurer l'impact sur le win ratio
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                  <Building2 className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Dirigeants & Executives</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Être présent sur chaque deal sans exploser l'agenda
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Garder le contrôle total sur son image et ses messages
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Approuver en un clic, où qu'on soit
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Differentiation Section — stronger visual */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Pourquoi Ekko est différent
            </h2>
            <p className="text-lg text-primary-foreground/70 mb-12">
              Les autres outils font de la vidéo IA.<br />
              <span className="font-semibold text-accent">Ekko est le seul outil qui observe le comportement du buying committee depuis l'intérieur.</span>
            </p>
            <div className="grid md:grid-cols-5 gap-4">
              {[
                { icon: Users, label: "Présence exécutive scalable" },
                { icon: FileText, label: "Différenciation RFP" },
                { icon: BarChart3, label: "Engagement décideurs mesuré" },
                { icon: Shield, label: "Gouvernance intégrée" },
                { icon: Zap, label: "Cycles complexes" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-3 p-4 bg-sidebar-accent rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-accent" />
                  </div>
                  <span className="text-sm font-medium text-primary-foreground text-center">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section — with results */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center">
              Cas d'usage
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border shadow-sm">
                <CardContent className="p-8">
                  <h3 className="text-lg font-semibold mb-3">Executive Sponsorship</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Le VP Sales envoie un message vidéo personnalisé au CEO du prospect 
                    pour renforcer la relation au moment critique du deal.
                  </p>
                  <p className="text-sm font-semibold text-accent">→ +23% win rate sur les deals avec exec video</p>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-8">
                  <h3 className="text-lg font-semibold mb-3">Réponse RFP personnalisée</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    L'AE inclut une vidéo du CEO dans la réponse RFP. 
                    Le prospect voit une entreprise qui s'engage personnellement.
                  </p>
                  <p className="text-sm font-semibold text-accent">→ 3× plus de shortlists vs RFP sans vidéo</p>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-8">
                  <h3 className="text-lg font-semibold mb-3">Deal acceleration</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Un deal stagne ? L'exec intervient en 3 minutes avec un message vidéo 
                    ciblé pour débloquer la situation — sans réunion.
                  </p>
                  <p className="text-sm font-semibold text-accent">→ -12 jours de cycle en moyenne</p>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-8">
                  <h3 className="text-lg font-semibold mb-3">Multi-threading exécutif</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Engagez plusieurs parties prenantes du buying committee 
                    avec des messages personnalisés de votre leadership.
                  </p>
                  <p className="text-sm font-semibold text-accent">→ 2,4 contacts engagés en moyenne par deal</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-accent text-accent-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Sécurisez votre revenue.
            </h2>
            <p className="text-lg mb-8 opacity-80">
              Scalez la présence exécutive sur chaque deal stratégique.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-base px-8 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => navigate("/auth")}
              >
                Demander une démo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-base px-8 bg-transparent border-accent-foreground/30 text-accent-foreground hover:bg-accent-foreground/10"
                onClick={() => navigate("/auth")}
              >
                Inscription
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer — proper enterprise links */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <EkkoLogo size={24} textSize={18} onDark={false} />
              </div>
              <p className="text-sm text-muted-foreground">Executive Deal Presence</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="font-semibold mb-3">Produit</p>
                <ul className="space-y-2 text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">Fonctionnalités</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Tarifs</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Sécurité</a></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-3">Ressources</p>
                <ul className="space-y-2 text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Changelog</a></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-3">Légal</p>
                <ul className="space-y-2 text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">Mentions légales</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Confidentialité</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">CGU</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© 2026 Ekko. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
