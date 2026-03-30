import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutList,
  Brain,
  MessageSquare,
  Users,
  CheckSquare,
  LogOut,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/constants";
import { NotificationBell } from "./NotificationBell";
import { EkkoLogo } from "@/components/ui/EkkoLogo";

const navigationItems = [
  {
    label: "Deals",
    href: "/app/campaigns",
    icon: LayoutList,
  },
  {
    label: "Deal Intelligence",
    href: "/app/deal-intelligence",
    icon: Brain,
  },
  {
    label: "Agent Ekko",
    href: "/app/dashboard",
    icon: MessageSquare,
  },
  {
    label: "Identités",
    href: "/app/identities",
    icon: Users,
  },
  {
    label: "Validations",
    href: "/app/approvals",
    icon: CheckSquare,
    badgeKey: "pendingApprovals" as const,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, profile, membership, org, signOut } = useAuthContext();
  const userRole = membership?.role || "org_user";
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const fetchPending = async () => {
      const { count } = await supabase
        .from("approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("assigned_to_user_id", user.id);
      setPendingCount(count || 0);
    };

    fetchPending();

    const channel = supabase
      .channel("approval-badge")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "approval_requests",
      }, () => fetchPending())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-marine text-ivory border-r border-marine-3">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-marine-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal font-bold text-marine text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              E
            </div>
            <span className="ekko-logo-text text-xl text-ivory">Ekko</span>
          </div>
          <NotificationBell />
        </div>

        {/* Organization */}
        {org && (
          <div className="px-4 py-4 border-b border-marine-3">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-marine-2">
              <Building2 className="w-4 h-4 text-slate-light" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ivory truncate">
                  {org.name}
                </p>
                <p className="text-xs text-slate-light">
                  {ROLE_LABELS[userRole]}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href === "/app/campaigns" && location.pathname.startsWith("/app/campaigns"));
              const Icon = item.icon;
              const showBadge = item.badgeKey === "pendingApprovals" && pendingCount > 0;

              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-marine-2 text-signal"
                        : "text-ivory/70 hover:bg-marine-2 hover:text-ivory"
                    )}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-1.5">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-marine-3">
          {profile && (
            <div className="mb-4 px-2">
              <p className="text-sm font-medium text-ivory">
                {profile.first_name} {profile.last_name}
              </p>
              <p className="text-xs text-slate-light truncate">
                {profile.email}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-ivory/70 hover:bg-marine-2 hover:text-ivory"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Déconnexion
          </Button>
        </div>
      </div>
    </aside>
  );
}
