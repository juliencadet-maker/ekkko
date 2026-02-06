import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Video, Shield, CheckSquare, Users } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl">E</div>
              <span className="text-4xl font-bold">Ekko</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Vidéos personnalisées<br /><span className="gradient-text">sécurisées pour l'entreprise</span></h1>
            <p className="text-xl text-muted-foreground mb-8">Plateforme de création vidéo avec gouvernance, approbation et traçabilité intégrées.</p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/auth")}><ArrowRight className="mr-2 h-5 w-5" />Commencer</Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>Se connecter</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: Video, title: "Vidéos IA", desc: "Génération automatique avec votre identité numérique" },
            { icon: Shield, title: "Gouvernance", desc: "Contrôle total, audit et conformité" },
            { icon: CheckSquare, title: "Approbation", desc: "Workflow de validation avant diffusion" },
            { icon: Users, title: "Multi-tenant", desc: "Sécurité et isolation par organisation" },
          ].map((f, i) => (
            <div key={i} className="p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow">
              <f.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 Ekko. Plateforme vidéo d'entreprise.</p>
        </div>
      </footer>
    </div>
  );
}
