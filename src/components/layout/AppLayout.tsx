import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { useSlackApprovalPolling } from "@/hooks/useSlackApprovalPolling";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Poll Slack for approval replies every 30s
  useSlackApprovalPolling();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
