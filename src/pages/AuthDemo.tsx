import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Building2, ArrowRight } from "lucide-react";

export default function AuthDemo() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, needsOnboarding } = useAuthContext();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      if (needsOnboarding) {
        navigate("/app/onboarding", { replace: true });
      } else {
        navigate("/app/dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, needsOnboarding, navigate]);

  const handleDemoLogin = async (email: string) => {
    setIsLoading(true);
    try {
      // Call edge function to get session tokens (password never leaves server)
      const { data, error } = await supabase.functions.invoke("demo-login", {
        body: { email },
      });

      if (error || !data?.access_token) {
        toast({ title: "Erreur", description: "Connexion démo échouée", variant: "destructive" });
        return;
      }

      // Set the session using returned tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) {
        toast({ title: "Erreur", description: "Impossible d'établir la session", variant: "destructive" });
      } else {
        toast({ title: "Connexion réussie", description: `Connecté en tant que ${email}` });
      }
    } catch {
      console.error("Demo login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
              E
            </div>
            <span className="text-3xl font-bold text-foreground">Ekko</span>
          </div>
          <p className="text-muted-foreground">
            Plateforme vidéo personnalisée pour les entreprises
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-medium">
            Mode démonstration
          </div>
        </div>

        {/* Demo Quick Login */}
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Comptes démo</CardTitle>
            <CardDescription className="text-xs">
              Testez les deux rôles pour voir le flux complet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => handleDemoLogin("demo@ekko.app")}
              disabled={isLoading}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium">Jean Dupont — VP Sales</p>
                <p className="text-xs text-muted-foreground">demo@ekko.app · Propriétaire</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => handleDemoLogin("exec@ekko.app")}
              disabled={isLoading}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                <Building2 className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium">Marc Lefevre — CEO</p>
                <p className="text-xs text-muted-foreground">exec@ekko.app · Administrateur</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Connexion en cours...</span>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Environnement de démonstration — données fictives
        </p>
      </div>
    </div>
  );
}
