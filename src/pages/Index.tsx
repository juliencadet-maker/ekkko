import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  LineChart
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

      {/* Hero Section */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              Votre présence sur chaque deal.<br />
              <span className="text-muted-foreground">Votre revenue sécurisé.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
              Ekko permet aux dirigeants et aux équipes commerciales de se rendre présents 
              sur tous leurs deals — réponses RFP, cycles longs, comptes stratégiques — 
              grâce à la vidéo personnalisée, avec gouvernance intégrée.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
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
        </div>
      </section>

      {/* Clarification Strip */}
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

            {/* Avec Ekko */}
            <Card className="border-accent/20 bg-accent/5">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <CheckCircle2 className="h-6 w-6 text-accent" />
                  <h3 className="text-lg font-semibold">Avec Ekko</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    Le CEO/VP est présent sur chaque deal critique, sans une seule réunion en plus
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    Chaque RFP inclut une touche personnalisée qui fait la différence
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    Vous mesurez l'impact de chaque intervention sur le deal
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

      {/* Solution Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
              Scalez la présence humaine.<br />
              <span className="text-muted-foreground">Augmentez le win ratio.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Ekko donne aux dirigeants et aux commerciaux la capacité d'être présents 
              sur chaque deal stratégique — avec intimité, confiance et contrôle — 
              sans multiplier les réunions.
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
                  description: "Votre AE identifie un deal stratégique et prépare un message personnalisé pour le décideur."
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
                  description: "Mesurez qui a regardé, combien de temps, et l'impact sur l'avancement du deal."
                }
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto text-2xl font-bold">
                      {item.step}
                    </div>
                  </div>
                  <item.icon className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* For Who Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center">
            Pour qui ?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
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
                  <Briefcase className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Équipes commerciales</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Se différencier dans les réponses RFP avec une vidéo personnalisée
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

      {/* Differentiation Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Pourquoi Ekko est différent
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Les autres outils font de la vidéo IA.<br />
              <span className="font-semibold text-foreground">Ekko sécurise votre revenue en scalant la présence humaine sur chaque deal.</span>
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                "Présence exécutive scalable",
                "Différenciation RFP",
                "Engagement décideurs mesuré",
                "Gouvernance intégrée",
                "Conçu pour les cycles de vente complexes"
              ].map((item) => (
                <span 
                  key={item} 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background border text-sm font-medium"
                >
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
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
                  <p className="text-muted-foreground leading-relaxed">
                    Le VP Sales envoie un message vidéo personnalisé au CEO du prospect 
                    pour renforcer la relation au moment critique du deal.
                  </p>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-8">
                  <h3 className="text-lg font-semibold mb-3">Réponse RFP personnalisée</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    L'AE inclut une vidéo du CEO dans la réponse RFP. 
                    Le prospect voit une entreprise qui s'engage personnellement.
                  </p>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-8">
                  <h3 className="text-lg font-semibold mb-3">Deal acceleration</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Un deal stagne ? L'exec intervient en 3 minutes avec un message vidéo 
                    ciblé pour débloquer la situation — sans réunion.
                  </p>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardContent className="p-8">
                  <h3 className="text-lg font-semibold mb-3">Multi-threading exécutif</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Engagez plusieurs parties prenantes du buying committee 
                    avec des messages personnalisés de votre leadership.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground">
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
                variant="secondary" 
                className="text-base px-8"
                onClick={() => navigate("/auth")}
              >
                Demander une démo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-base px-8 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => navigate("/auth")}
              >
                Inscription
              </Button>
              <Button 
                size="lg" 
                variant="ghost" 
                className="text-base px-8 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => navigate("/auth")}
              >
                Connexion
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">E</div>
              <span className="font-semibold">Ekko</span>
              <span className="text-muted-foreground text-sm ml-2">— Executive Deal Presence</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>Présence</span>
              <span>•</span>
              <span>Confiance</span>
              <span>•</span>
              <span>Revenue</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Mentions légales
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Politique de confidentialité
              </a>
            </div>
          </div>
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>© 2025 Ekko. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
