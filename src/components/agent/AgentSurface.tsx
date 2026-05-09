// Phase 4 — Unified Agent surface. Two modes:
//   - "compact" : drawer/embedded chat (480px), used in deal-detail / mobile fullscreen.
//   - "full"    : panel with side column for "Actions en attente" + history.
// Both modes reuse the existing EkkoAgent component for chat (intouchable preserved).
import { EkkoAgent } from "@/components/campaign/EkkoAgent";
import { PendingActionsList } from "./PendingActionsList";
import { useAuthContext } from "@/contexts/AuthContext";

interface AgentSurfaceProps {
  mode: "compact" | "full";
  campaignId: string;
  campaignName: string;
  viewers?: any[];
  dealScore?: any;
  initialPrompt?: string;
  onClose?: () => void;
}

export function AgentSurface(props: AgentSurfaceProps) {
  const { user } = useAuthContext();

  if (props.mode === "compact") {
    return (
      <div className="h-full w-full">
        <EkkoAgent
          campaignId={props.campaignId}
          campaignName={props.campaignName}
          viewers={props.viewers}
          dealScore={props.dealScore}
          initialPrompt={props.initialPrompt}
          onClose={props.onClose}
        />
      </div>
    );
  }

  // Full mode — chat on the left, pending actions panel on the right.
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-full">
      <div className="min-h-0">
        <EkkoAgent
          campaignId={props.campaignId}
          campaignName={props.campaignName}
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
