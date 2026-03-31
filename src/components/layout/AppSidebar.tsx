import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import { canManageOrg } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutList,
  Brain,
  MessageSquare,
  Users,
  CheckSquare,
  LogOut,
  Building2,
  Shield,
  Zap,
  FileText,
  Crown,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ROLE_LABELS } from "@/lib/constants";
import { NotificationBell } from "./NotificationBell";
import { EkkoLogo } from "@/components/ui/EkkoLogo";

const navigationItems = [
  { label: "Deals", href: "/app/campaigns", icon: LayoutList },
  { label: "Agent Ekko", href: "/app/agent", icon: MessageSquare },
  { label: "Deal Intelligence", href: "/app/deal-intelligence", icon: Brain },
  { label: "Identités", href: "/app/identities", icon: Users },
  {
    label: "Validations",
    href: "/app/approvals",
    icon: CheckSquare,
    badgeKey: "pendingApprovals" as const,
  },
];

const adminItems = [
  { label: "Comptes", href: "/app/user-approvals", icon: UserCheck },
  { label: "Gouvernance", href: "/app/governance", icon: Shield },
  { label: "Intégrations", href: "/app/settings", icon: Zap },
  { label: "Audit", href: "/app/audit", icon: FileText },
];

const ROLE_ICONS: Record<string, typeof Crown> = {
  org_owner: Crown,
  org_admin: ShieldCheck,
  org_manager: Users,
  org_user: User,
};

function getColdStartLabel(count: number): string {
  if (count === 0) return "Mode démarrage";
  if (count <= 4) return "Apprentissage";
  if (count <= 19) return "Intelligence active";
  return "Pipeline tracké";
}

export function AppSidebar() {
  const location = useLocation();
  const { user, profile, membership, org, signOut } = useAuthContext();
  const userRole = membership?.role || "org_user";
  const [pendingCount, setPendingCount] = useState(0);
  const [campaignCount, setCampaignCount] = useState(0);

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

  // Campaign count for cold start indicator
  useEffect(() => {
    if (!membership?.org_id) return;
    supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("org_id", membership.org_id)
      .then(({ count }) => setCampaignCount(count || 0));
  }, [membership?.org_id]);

  const renderNavItem = (item: typeof navigationItems[0]) => {
    const isActive = location.pathname === item.href ||
      (item.href === "/app/campaigns" && location.pathname.startsWith("/app/campaigns"));
    const Icon = item.icon;
    const showBadge = (item as any).badgeKey === "pendingApprovals" && pendingCount > 0;

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
  };

  const RoleIcon = ROLE_ICONS[userRole] || User;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-marine text-ivory border-r border-marine-3">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-marine-3">
          <EkkoLogo size={28} textSize={20} onDark={true} />
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
                <div className="flex items-center gap-1 text-xs text-slate-light mt-1">
                  <RoleIcon className="w-3 h-3" />
                  <span>{ROLE_LABELS[userRole]}</span>
                </div>
                <p className="text-[10px] text-slate-light/60 mt-0.5">
                  {getColdStartLabel(campaignCount)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navigationItems.map(renderNavItem)}
          </ul>

          {/* Admin section */}
          {canManageOrg(userRole) && (
            <>
              <Separator className="my-4 bg-marine-3" />
              <p className="text-xs text-slate-light uppercase tracking-widest px-3 py-2">
                Administration
              </p>
              <ul className="space-y-1">
                {adminItems.map(renderNavItem)}
              </ul>
            </>
          )}
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
