import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Video,
  Users,
  CheckSquare,
  Settings,
  FileText,
  LogOut,
  Shield,
  Building2,
  LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ROLE_LABELS } from "@/lib/constants";
import { NotificationBell } from "./NotificationBell";

const navigationItems = [
  {
    label: "Tableau de bord",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    roles: ["org_owner", "org_admin", "org_manager", "org_user"],
  },
  {
    label: "Deals",
    href: "/app/campaigns",
    icon: Video,
    roles: ["org_owner", "org_admin", "org_manager", "org_user"],
  },
  {
    label: "Identités",
    href: "/app/identities",
    icon: Users,
    roles: ["org_owner", "org_admin", "org_manager", "org_user"],
  },
  {
    label: "Deal Intelligence",
    href: "/app/deal-intelligence",
    icon: LineChart,
    roles: ["org_owner", "org_admin", "org_manager"],
  },
  {
    label: "Validations",
    href: "/app/approvals",
    icon: CheckSquare,
    roles: ["org_owner", "org_admin", "org_manager", "org_user"],
    badgeKey: "pendingApprovals" as const,
  },
  {
    label: "Journal d'audit",
    href: "/app/audit",
    icon: FileText,
    roles: ["org_owner", "org_admin"],
  },
  {
    label: "Gouvernance",
    href: "/app/governance",
    icon: Shield,
    roles: ["org_owner", "org_admin"],
  },
  {
    label: "Paramètres",
    href: "/app/settings",
    icon: Settings,
    roles: ["org_owner", "org_admin"],
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

  const filteredNavItems = navigationItems.filter(
    (item) => item.roles.includes(userRole)
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold">
              E
            </div>
            <span className="text-xl font-bold text-sidebar-foreground">Ekko</span>
          </div>
          <NotificationBell />
        </div>

        {/* Organization */}
        {org && (
          <div className="px-4 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-sidebar-accent">
              <Building2 className="w-4 h-4 text-sidebar-accent-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
                  {org.name}
                </p>
                <p className="text-xs text-sidebar-foreground/60">
                  {ROLE_LABELS[userRole]}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              const showBadge = item.badgeKey === "pendingApprovals" && pendingCount > 0;

              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
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

        <Separator className="bg-sidebar-border" />

        {/* User Section */}
        <div className="p-4">
          {profile && (
            <div className="mb-4 px-2">
              <p className="text-sm font-medium text-sidebar-foreground">
                {profile.first_name} {profile.last_name}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {profile.email}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
