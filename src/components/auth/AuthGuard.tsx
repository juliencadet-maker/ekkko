import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: ReactNode;
  requireOnboarding?: boolean;
}

export function AuthGuard({ children, requireOnboarding = true }: AuthGuardProps) {
  const { isLoading, isAuthenticated, needsOnboarding } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate("/auth", { replace: true });
      return;
    }

    // Redirect to onboarding if needed
    if (requireOnboarding && needsOnboarding && !location.pathname.startsWith("/app/onboarding")) {
      navigate("/app/onboarding", { replace: true });
      return;
    }

    // If on onboarding but already completed, redirect to dashboard
    if (location.pathname.startsWith("/app/onboarding") && !needsOnboarding) {
      navigate("/app/dashboard", { replace: true });
    }
  }, [isLoading, isAuthenticated, needsOnboarding, requireOnboarding, navigate, location.pathname]);

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

  return <>{children}</>;
}
