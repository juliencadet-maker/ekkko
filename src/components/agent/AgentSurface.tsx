// 1d.5h-bis Phase 2 — AgentSurface unifié.
// compact = drawer Sheet (Cmd+K + FloatingButton, density="compact").
//   • campaignId null → portfolio (cross-deal) input réel, plus d'empty state.
// full    = panneau embarqué AgentPage (density="full").
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EkkoAgent } from "@/components/campaign/EkkoAgent";
import { PendingActionsList } from "./PendingActionsList";
import { useAuthContext } from "@/contexts/AuthContext";

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

export function AgentSurface(props: AgentSurfaceProps) {
  const { user } = useAuthContext();
  const campaignId = props.campaignId ?? null;
  const isPortfolio = !campaignId;

  if (props.mode === "compact") {
    return (
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:w-[480px] p-0 flex flex-col bg-background"
        >
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-sm font-semibold">
              {isPortfolio ? "Agent Ekko — Portfolio" : (props.campaignName || "Agent Ekko")}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <EkkoAgent
              density="compact"
              campaignId={campaignId}
              campaignName={props.campaignName ?? ""}
              viewers={props.viewers}
              dealScore={props.dealScore}
              initialPrompt={props.initialPrompt}
              onClose={() => props.onOpenChange?.(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Full mode — chat + pending actions côte à côte.
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-full">
      <div className="min-h-0">
        <EkkoAgent
          density="full"
          campaignId={campaignId}
          campaignName={props.campaignName ?? ""}
          viewers={props.viewers}
          dealScore={props.dealScore}
          initialPrompt={props.initialPrompt}
        />
      </div>
      <aside className="border rounded-lg bg-card p-4 overflow-y-auto">
        <PendingActionsList userId={user?.id ?? null} />
      </aside>
    </div>
  );
}
