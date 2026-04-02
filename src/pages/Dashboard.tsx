import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { canSeeAllDeals, canManageOrg } from "@/lib/roles";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EkkoLoader } from "@/components/ui/EkkoLoader";
import { 
  AlertTriangle, 
  Plus,
  ArrowRight,
  Clock,
  Zap,
  CheckSquare,
  LayoutList,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Campaign, ApprovalRequest } from "@/types/database";

interface TeamMember {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  activeCampaigns: number;
  avgDes: number | null;
}

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    dealsEnAlerte: 0,
    nouveauxSignaux: 0,
    validationsEnAttente: 0,
    dealsActifs: 0,
  });
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const navigate = useNavigate();
  const { profile, membership, user } = useAuthContext();
  const userRole = membership?.role || "org_user";

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!membership?.org_id) { setIsLoading(false); return; }

      try {
        // Deals actifs (not completed/cancelled)
        const { count: activeDeals } = await supabase
          .from("campaigns")
          .select("*", { count: "exact", head: true })
          .eq("org_id", membership.org_id)
          .not("status", "in", '("completed","cancelled")');

        // Pending approvals
        const { count: pendingCount } = await supabase
          .from("approval_requests")
          .select("*", { count: "exact", head: true })
          .eq("org_id", membership.org_id)
          .eq("status", "pending");

        // Fetch org campaigns to scope deal_scores
        const { data: orgCampaigns } = await supabase
          .from("campaigns")
          .select("id")
          .eq("org_id", membership.org_id);
        const campaignIds = (orgCampaigns || []).map((c: any) => c.id);
        if (campaignIds.length === 0) {
          setStats({ dealsEnAlerte: 0, nouveauxSignaux: 0,
            validationsEnAttente: pendingCount || 0, dealsActifs: activeDeals || 0 });
          setIsLoading(false); return;
        }

        // Count deals with critical alerts (DES < 40)
        const { data: allScores } = await supabase
          .from("deal_scores")
          .select("campaign_id, des")
          .in("campaign_id", campaignIds)
          .order("scored_at", { ascending: false });

        const latestScores: Record<string, number> = {};
        allScores?.forEach(s => {
          if (!latestScores[s.campaign_id] && s.des != null) {
            latestScores[s.campaign_id] = s.des;
          }
        });
        const alertCount = Object.values(latestScores).filter(d => d < 40).length;

        // Today's signals (video events from today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: signalCount } = await supabase
          .from("video_events")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today.toISOString());

        setStats({
          dealsEnAlerte: alertCount,
          nouveauxSignaux: signalCount || 0,
          validationsEnAttente: pendingCount || 0,
          dealsActifs: activeDeals || 0,
        });

        // Recent campaigns
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("*, identities(display_name)")
          .eq("org_id", membership.org_id)
          .order("created_at", { ascending: false })
          .limit(5);
        setRecentCampaigns(campaigns as Campaign[] || []);

        // Pending approvals
        const { data: approvals } = await supabase
          .from("approval_requests")
          .select("*, campaigns(name, script)")
          .eq("org_id", membership.org_id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5);
        setPendingApprovals(approvals as ApprovalRequest[] || []);

        // Team activity (admin only)
        if (canManageOrg(userRole) && membership.org_id) {
          const { data: members } = await supabase
            .from("org_memberships")
            .select("user_id, profiles(first_name, last_name)")
            .eq("org_id", membership.org_id)
            .eq("is_active", true);

          if (members) {
            const memberList: TeamMember[] = [];
            for (const m of members as any[]) {
              const { count: activeCampaignCount } = await supabase
                .from("campaigns")
                .select("*", { count: "exact", head: true })
                .eq("org_id", membership.org_id)
                .eq("created_by_user_id", m.user_id)
                .not("status", "in", '("completed","cancelled")');

              memberList.push({
                userId: m.user_id,
                firstName: m.profiles?.first_name || null,
                lastName: m.profiles?.last_name || null,
                activeCampaigns: activeCampaignCount || 0,
                avgDes: null,
              });
            }
            setTeamMembers(memberList);
          }
        }

      } catch { console.error("Dashboard fetch failed"); }
      finally { setIsLoading(false); }
    };

    fetchDashboardData();
  }, [membership?.org_id, userRole]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <EkkoLoader mode="once" size={40} />
        </div>
      </AppLayout>
    );
  }

  const metricCards = [
    {
      label: "Deals en alerte",
      value: stats.dealsEnAlerte,
      icon: AlertTriangle,
      color: stats.dealsEnAlerte > 0 ? "text-destructive" : "text-muted-foreground",
      bgColor: stats.dealsEnAlerte > 0 ? "bg-destructive/10" : "bg-muted",
      onClick: () => navigate("/app/campaigns"),
    },
    {
      label: "Nouveaux signaux aujourd'hui",
      value: stats.nouveauxSignaux,
      icon: Zap,
      color: "text-info",
      bgColor: "bg-info/10",
      onClick: () => navigate("/app/deal-intelligence"),
    },
    {
      label: "Validations en attente",
      value: stats.validationsEnAttente,
      icon: CheckSquare,
      color: stats.validationsEnAttente > 0 ? "text-warning" : "text-muted-foreground",
      bgColor: stats.validationsEnAttente > 0 ? "bg-warning/10" : "bg-muted",
      onClick: () => navigate("/app/approvals"),
    },
    {
      label: "Deals actifs",
      value: stats.dealsActifs,
      icon: LayoutList,
      color: "text-foreground",
      bgColor: "bg-primary/10",
      onClick: () => navigate("/app/campaigns"),
    },
  ];

  return (
    <AppLayout>
      <PageHeader 
        title={`Bonjour, ${profile?.first_name || "utilisateur"} 👋`}
        description={canManageOrg(userRole) ? "Pipeline de votre équipe et signaux en temps réel." : "Vos deals actifs et signaux des dernières 24h."}
        actions={
          <Button onClick={() => navigate("/app/campaigns/new")} className="rounded-cta bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau deal
          </Button>
        }
      />

      {/* 4 Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metricCards.map((m) => {
          const Icon = m.icon;
          const isZero = m.value === 0;
          return (
            <div
              key={m.label}
              className={`metric-card cursor-pointer hover:shadow-lg transition-all ${isZero ? "opacity-70" : ""}`}
              onClick={m.onClick}
              role="button"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`${isZero ? "text-lg" : "text-3xl"} font-bold text-foreground`}>
                    {m.value}
                  </p>
                  <p className="metric-label">{m.label}</p>
                </div>
                <div className={`p-2 rounded-lg ${m.bgColor}`}>
                  <Icon className={`w-5 h-5 ${m.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Deals */}
        <Card className="lg:col-span-2 rounded-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{canSeeAllDeals(userRole) ? "Deals de l'équipe" : "Mes deals actifs"}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/campaigns")}>
              Voir tout <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <EmptyState
                icon={LayoutList}
                title="Aucun deal"
                description="Créez votre premier deal pour commencer"
                action={{ label: "Créer un deal", onClick: () => navigate("/app/campaigns/new") }}
              />
            ) : (
              <div className="space-y-2">
                {recentCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
                  >
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(campaign as any).identities?.display_name}
                      </p>
                    </div>
                    <StatusBadge status={campaign.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card className="rounded-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Validations en attente</CardTitle>
            {pendingApprovals.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/app/approvals")}>
                Voir tout
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune validation en attente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate("/app/approvals")}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-warning" />
                      <p className="font-medium text-sm">{(approval as any).campaigns?.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {(approval as any).campaigns?.script?.substring(0, 100)}...
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Activity (admin only) */}
      {canManageOrg(userRole) && teamMembers.length > 0 && (
        <Card className="rounded-card mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Activité de l'équipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teamMembers.map((member) => {
                const initials = `${(member.firstName || "?")[0]}${(member.lastName || "?")[0]}`.toUpperCase();
                return (
                  <div key={member.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.firstName} {member.lastName}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {member.activeCampaigns} deal{member.activeCampaigns !== 1 ? "s" : ""} actif{member.activeCampaigns !== 1 ? "s" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
