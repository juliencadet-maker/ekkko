import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Video, 
  Eye, 
  CheckSquare, 
  AlertTriangle, 
  Plus,
  ArrowRight,
  Clock,
} from "lucide-react";
import type { Campaign, ApprovalRequest } from "@/types/database";


export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    videosGenerated: 0,
    totalViews: 0,
    pendingApprovals: 0,
    complianceAlerts: 0,
  });
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);

  const navigate = useNavigate();
  const { profile, membership } = useAuthContext();

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!membership?.org_id) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch video count
        const { count: videoCount } = await supabase
          .from("videos")
          .select("*", { count: "exact", head: true })
          .eq("org_id", membership.org_id);

        // Fetch total views
        const { data: videos } = await supabase
          .from("videos")
          .select("view_count")
          .eq("org_id", membership.org_id);
        
        const totalViews = videos?.reduce((sum, v) => sum + (v.view_count || 0), 0) || 0;

        // Fetch pending approvals count
        const { count: pendingCount } = await supabase
          .from("approval_requests")
          .select("*", { count: "exact", head: true })
          .eq("org_id", membership.org_id)
          .eq("status", "pending");

        setStats({
          videosGenerated: videoCount || 0,
          totalViews,
          pendingApprovals: pendingCount || 0,
          complianceAlerts: 0,
        });

        // Fetch recent campaigns
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("*, identities(display_name)")
          .eq("org_id", membership.org_id)
          .order("created_at", { ascending: false })
          .limit(5);

        setRecentCampaigns(campaigns as Campaign[] || []);

        // Fetch pending approval requests
        const { data: approvals } = await supabase
          .from("approval_requests")
          .select("*, campaigns(name, script)")
          .eq("org_id", membership.org_id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5);

        setPendingApprovals(approvals as ApprovalRequest[] || []);

      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [membership?.org_id]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Chargement...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader 
        title={`Bonjour, ${profile?.first_name || "utilisateur"} 👋`}
        description="Présence exécutive et impact sur vos deals"
        actions={
          <Button onClick={() => navigate("/app/campaigns/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle campagne
          </Button>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={Video}
          value={stats.videosGenerated}
          label="Deals avec présence exécutive"
        />
        <MetricCard
          icon={Eye}
          value={stats.totalViews}
          label="Vues par les décideurs"
        />
        <MetricCard
          icon={CheckSquare}
          value={stats.pendingApprovals}
          label="Validations en attente"
        />
        <MetricCard
          icon={AlertTriangle}
          value={stats.complianceAlerts}
          label="Alertes conformité"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Campaigns */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Campagnes récentes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/campaigns")}>
              Voir tout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <EmptyState
                icon={Video}
                title="Aucune campagne"
                description="Créez votre première campagne vidéo pour commencer"
                action={{
                  label: "Créer une campagne",
                  onClick: () => navigate("/app/campaigns/new"),
                }}
              />
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
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
        <Card>
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
              <div className="space-y-3">
                {pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate("/app/approvals")}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-warning" />
                      <p className="font-medium text-sm">
                        {(approval as any).campaigns?.name}
                      </p>
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

      {/* Quick Actions — deal-first */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button variant="outline" className="h-auto py-4 flex-col gap-1" onClick={() => navigate("/app/campaigns/new")}>
          <Plus className="h-5 w-5" />
          <span className="text-sm font-medium">Nouveau deal</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-1" onClick={() => navigate("/app/identities")}>
          <Video className="h-5 w-5" />
          <span className="text-sm font-medium">Gérer les identités</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-1" onClick={() => navigate("/app/deal-intelligence")}>
          <Eye className="h-5 w-5" />
          <span className="text-sm font-medium">Deal Intelligence</span>
        </Button>
      </div>
    </AppLayout>
  );
}
