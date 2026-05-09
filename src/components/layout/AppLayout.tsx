import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useSlackApprovalPolling } from "@/hooks/useSlackApprovalPolling";
import { FloatingButton } from "@/components/agent/FloatingButton";
import { AgentSurface } from "@/components/agent/AgentSurface";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Poll Slack for approval replies every 30s
  useSlackApprovalPolling();

  const location = useLocation();
  const [agentOpen, setAgentOpen] = useState(false);

  // On AgentPage the page itself IS the agent in full mode → skip drawer + button.
  const skipDrawer = location.pathname === "/app/agent";

  // Detect campaignId from URL when on a deal page (compact drawer is deal-scoped).
  const campaignId = location.pathname.match(/\/app\/campaigns\/([^/]+)/)?.[1] ?? null;

  // Cmd+K / Ctrl+K toggle (disabled on AgentPage).
  useEffect(() => {
    if (skipDrawer) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAgentOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [skipDrawer]);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <div className="p-8">{children}</div>
      </main>

      {!skipDrawer && (
        <>
          <FloatingButton onClick={() => setAgentOpen(true)} />
          <AgentSurface
            mode="compact"
            campaignId={campaignId}
            open={agentOpen}
            onOpenChange={setAgentOpen}
          />
        </>
      )}
    </div>
  );
}
