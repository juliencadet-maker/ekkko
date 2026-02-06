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
  Scale
} from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">E</div>
            <span className="text-xl font-semibold">Ekko</span>
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
              Sécurisez chaque deal.<br />
              <span className="text-muted-foreground">Sans être à chaque réunion.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
              Ekko permet aux dirigeants et équipes commerciales d'être présents sur tous leurs deals 
              grâce à la vidéo personnalisée, avec validation, gouvernance et traçabilité intégrées.
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
              Conçu pour les cycles de vente complexes et les environnements enterprise.
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
                    Des deals critiques sans présence exécutive
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    Des messages non maîtrisés
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    Aucun contrôle ni traçabilité
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
                    Une présence humaine sur chaque deal clé
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    Des messages validés et sécurisés
                  </li>
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    Une traçabilité complète
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
              Vos deals avancent.<br />
              <span className="text-muted-foreground">Votre agenda est déjà plein.</span>
            </h2>
            <ul className="space-y-4 mb-8 text-lg text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-primary mt-2.5 shrink-0" />
                Impossible d'être présent sur chaque opportunité stratégique
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-primary mt-2.5 shrink-0" />
                Trop de réunions pour sécuriser les deals importants
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-primary mt-2.5 shrink-0" />
                Des messages envoyés sans validation claire
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-primary mt-2.5 shrink-0" />
                Aucune visibilité sur ce qui a été dit, à qui, et quand
              </li>
            </ul>
            <p className="text-xl font-semibold text-foreground">
              Résultat : des deals fragilisés et une perte de contrôle.
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
              La présence humaine à grande échelle.<br />
              <span className="text-muted-foreground">Sans perte de contrôle.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Ekko vous permet de déployer votre voix, votre image et votre autorité 
              sur chaque deal stratégique, sans multiplier les réunions 
              et sans déléguer votre crédibilité.
            </p>
          </div>
        </div>
      </section>

      {/* Three Pillars Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Sécurisation des deals</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Aucune vidéo sans validation. Chaque message est approuvé, gouverné et conforme 
                  aux règles internes de votre organisation.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Présence sur tous les deals</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Votre voix sur chaque opportunité clé, même lorsque vous ne pouvez pas être présent.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Gain de temps réel</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Zéro réunion en plus. Zéro friction pour les équipes commerciales et les dirigeants.
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
                  title: "Le message",
                  description: "Vous rédigez un message personnalisé pour un deal précis."
                },
                {
                  step: 2,
                  icon: CheckSquare,
                  title: "La validation",
                  description: "Le message est validé automatiquement ou manuellement selon vos règles internes."
                },
                {
                  step: 3,
                  icon: Send,
                  title: "La diffusion",
                  description: "Ekko génère et diffuse la vidéo de façon sécurisée et traçable."
                },
                {
                  step: 4,
                  icon: Eye,
                  title: "Le contrôle",
                  description: "Vous savez exactement qui a parlé, à qui, quand, et sur quel deal."
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
                  <Building2 className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Dirigeants & Executives</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Être présent sur tous les deals stratégiques
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Sans exploser l'agenda
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Sans perdre le contrôle de son image
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
                    Plus d'engagement sur les deals clés
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Une autorité renforcée dans les cycles longs
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Aucun outil complexe à gérer
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                  <Scale className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Legal / Comms / RevOps</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Gouvernance claire
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Audit exportable
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    Traçabilité complète des communications vidéo
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
              <span className="font-semibold text-foreground">Ekko fait de la gouvernance de présence exécutive.</span>
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                "Validation intégrée",
                "Audit trail natif",
                "Rôles et permissions",
                "Sécurité enterprise",
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

      {/* Evolution Note */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
            Ekko est conçu pour s'étendre naturellement au recrutement, 
            à la communication interne et au customer success, 
            sans jamais compromettre la gouvernance.
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              Sécurisez vos deals dès maintenant.
            </h2>
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
              <span className="text-muted-foreground text-sm ml-2">— Governed AI Video</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>Sécurité</span>
              <span>•</span>
              <span>Gouvernance</span>
              <span>•</span>
              <span>Traçabilité</span>
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
            <p>© 2024 Ekko. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
