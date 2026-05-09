// Phase 4-fix — Unified AgentSurface.
// "compact" mode = Sheet drawer (480px desktop / fullscreen mobile),
//                  used by AppLayout for global Cmd+K + FloatingButton.
//                  When campaignId is null → cross-deal mode (portfolio chat
//                  is deferred; we show a clear empty state + pending list).
// "full" mode    = embedded panel for AgentPage with chat + pending list side-by-side.
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EkkoAgent } from "@/components/campaign/EkkoAgent";
import { PendingActionsList } from "./PendingActionsList";
import { useAuthContext } from "@/contexts/AuthContext";
import { MessageSquare } from "lucide-react";

interface AgentSurfaceProps {
  mode: "compact" | "full";
  campaignId?: string | null;
  campaignName?: string;
  viewers?: any[];
  dealScore?: any;
  initialPrompt?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

function CrossDealEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
      <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm font-semibold">Sélectionnez un deal pour démarrer</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        L'agent répond toujours dans le contexte d'un deal précis. Choisissez-en un depuis vos campagnes,
        ou consultez vos actions en attente ci-dessous.
      </p>
    </div>
  );
}

export function AgentSurface(props: AgentSurfaceProps) {
  const { user } = useAuthContext();

  if (props.mode === "compact") {
    return (
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:w-[480px] p-0 flex flex-col"
        >
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-sm">
              {props.campaignId ? (props.campaignName || "Agent Ekko") : "Agent Ekko"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            {props.campaignId ? (
              <EkkoAgent
                campaignId={props.campaignId}
                campaignName={props.campaignName ?? ""}
                viewers={props.viewers}
                dealScore={props.dealScore}
                initialPrompt={props.initialPrompt}
                onClose={() => props.onOpenChange?.(false)}
              />
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <CrossDealEmpty />
                </div>
                <div className="border-t p-4 max-h-[50%] overflow-y-auto">
                  <PendingActionsList userId={user?.id ?? null} />
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Full mode — chat + pending actions side-by-side.
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-full">
      <div className="min-h-0">
        {props.campaignId ? (
          <EkkoAgent
            campaignId={props.campaignId}
            campaignName={props.campaignName ?? ""}
            viewers={props.viewers}
            dealScore={props.dealScore}
            initialPrompt={props.initialPrompt}
          />
        ) : (
          <CrossDealEmpty />
        )}
      </div>
      <aside className="border rounded-lg bg-card p-4 overflow-y-auto">
        <PendingActionsList userId={user?.id ?? null} />
      </aside>
    </div>
  );
}
