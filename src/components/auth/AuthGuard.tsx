import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Loader2, Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthGuardProps {
  children: ReactNode;
  requireOnboarding?: boolean;
}

export function AuthGuard({ children, requireOnboarding = true }: AuthGuardProps) {
  const { isLoading, isAuthenticated, needsOnboarding, isPendingApproval, signOut } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate("/auth", { replace: true });
      return;
    }

    // Don't redirect if pending approval — show the gate screen
    if (isPendingApproval) return;

    // Redirect to onboarding if needed
    if (requireOnboarding && needsOnboarding && !location.pathname.startsWith("/app/onboarding")) {
      navigate("/app/onboarding", { replace: true });
      return;
    }

    // If on onboarding but already completed, redirect to dashboard
    if (location.pathname.startsWith("/app/onboarding") && !needsOnboarding) {
      navigate("/app/dashboard", { replace: true });
    }
  }, [isLoading, isAuthenticated, needsOnboarding, isPendingApproval, requireOnboarding, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (isPendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Compte en attente de validation</h1>
            <p className="text-muted-foreground">
              Votre inscription a bien été prise en compte. Un administrateur doit valider votre compte avant que vous puissiez accéder à l'application.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
            Vous recevrez un email dès que votre compte sera activé.
          </div>
          <Button variant="outline" onClick={() => signOut()} className="gap-2">
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
