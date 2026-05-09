// Phase 4-fix — Floating button (Sparkles + agent pending badge), opens AgentSurface compact.
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAgentNotifications } from "@/hooks/useAgentNotifications";
import { useAuthContext } from "@/contexts/AuthContext";

export function FloatingButton({ onClick }: { onClick: () => void }) {
  const { user } = useAuthContext();
  const { pendingCount } = useAgentNotifications(user?.id ?? null);
  return (
    <Button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#1AE08A] hover:bg-[#1AE08A]/90 shadow-lg p-0"
      aria-label="Ouvrir agent Ekko (Cmd+K)"
      title="Agent Ekko · Cmd+K"
    >
      <Sparkles className="h-6 w-6 text-[#0D1B2A]" />
      {pendingCount > 0 && (
        <Badge className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground h-5 min-w-5 px-1 text-[10px] font-bold">
          {pendingCount > 99 ? "99+" : pendingCount}
        </Badge>
      )}
    </Button>
  );
}
