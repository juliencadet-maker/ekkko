import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Video, Building2, Layers, Zap, TrendingUp, TrendingDown, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Campaign } from "@/types/database";

interface DealScoreRow {
  campaign_id: string;
  des: number | null;
  momentum: string | null;
  viewer_count: number | null;
  sponsor_count: number | null;
  blocker_count: number | null;
}

export default function Campaigns() {
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dealScores, setDealScores] = useState<Record<string, DealScoreRow>>({});

  const navigate = useNavigate();
  const { membership } = useAuthContext();

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!membership?.org_id) return;

      try {
        const { data, error } = await supabase
          .from("campaigns")
          .select("*, identities(display_name)")
          .eq("org_id", membership.org_id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        const campaignList = (data as Campaign[]) || [];
        setCampaigns(campaignList);

        // Fetch latest deal scores for all campaigns
        const campaignIds = campaignList.map((c) => c.id);
        if (campaignIds.length > 0) {
          const { data: scores } = await supabase
            .from("deal_scores")
            .select("campaign_id, des, momentum, viewer_count, sponsor_count, blocker_count")
            .in("campaign_id", campaignIds)
            .order("scored_at", { ascending: false });

          if (scores) {
            const scoreMap: Record<string, DealScoreRow> = {};
            for (const s of scores as DealScoreRow[]) {
              if (!scoreMap[s.campaign_id]) scoreMap[s.campaign_id] = s;
            }
            setDealScores(scoreMap);
          }
        }
      } catch {
        console.error("Fetch campaigns failed");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [membership?.org_id]);

  const parentCampaigns = useMemo(() => {
    const parents = campaigns.filter((c) => !c.parent_campaign_id);
    return parents.map((p) => ({
      ...p,
      sub_campaigns: campaigns.filter((c) => c.parent_campaign_id === p.id),
    }));
  }, [campaigns]);

  const displayCampaigns = useMemo(() => {
    return parentCampaigns.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sub_campaigns?.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [parentCampaigns, searchQuery]);

  const getStatusSummary = (subs: Campaign[]) => {
    if (subs.length === 0) return null;
    const completed = subs.filter((s) => s.status === "completed").length;
    const generating = subs.filter((s) => s.status === "generating").length;
    const draft = subs.filter((s) => s.status === "draft").length;
    return { completed, generating, draft, total: subs.length };
  };

  const getMomentumIcon = (momentum: string | null) => {
    if (momentum === "rising") return <TrendingUp className="h-3 w-3 text-emerald-600" />;
    if (momentum === "declining") return <TrendingDown className="h-3 w-3 text-red-600" />;
    return null;
  };

  const getDesColor = (des: number | null) => {
    if (des === null) return "bg-muted text-muted-foreground";
    if (des >= 70) return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    if (des >= 40) return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    return "bg-red-500/15 text-red-700 border-red-500/30";
  };

  return (
    <AppLayout>
      <PageHeader
        title="Deals"
        description="Gérez vos deals et leur présence exécutive vidéo"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => navigate("/app/campaigns/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau deal
            </Button>
          </div>
        }
      />

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un compte..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Chargement...</div>
        </div>
      ) : displayCampaigns.length === 0 ? (
        <EmptyState
          icon={Video}
          title="Aucun compte"
          description={searchQuery ? "Aucun résultat pour cette recherche" : "Créez votre premier compte cible"}
          action={
            searchQuery
              ? undefined
              : {
                  label: "Créer un compte",
                  onClick: () => navigate("/app/campaigns/new"),
                }
          }
          className="py-16"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayCampaigns.map((campaign) => {
            const subs = campaign.sub_campaigns || [];
            const statusSummary = getStatusSummary(subs);
            const score = dealScores[campaign.id];

            return (
              <Card
                key={campaign.id}
                className="cursor-pointer group hover:shadow-lg transition-all duration-200 hover:border-primary/30"
                onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
              >
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {campaign.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {(campaign as any).identities?.display_name || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {score?.des != null && (
                        <Badge variant="outline" className={`text-[10px] font-bold px-1.5 py-0 ${getDesColor(score.des)}`}>
                          <Zap className="h-2.5 w-2.5 mr-0.5" />
                          {score.des}
                        </Badge>
                      )}
                      <StatusBadge status={campaign.status} />
                    </div>
                  </div>

                  {campaign.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {campaign.description}
                    </p>
                  )}

                  {/* Deal Intelligence Row */}
                  {score && (
                    <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-muted/50">
                      {score.viewer_count != null && score.viewer_count > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{score.viewer_count}</span>
                        </div>
                      )}
                      {score.sponsor_count != null && score.sponsor_count > 0 && (
                        <div className="flex items-center gap-1 text-xs text-emerald-600">
                          <span>👍 {score.sponsor_count}</span>
                        </div>
                      )}
                      {score.blocker_count != null && score.blocker_count > 0 && (
                        <div className="flex items-center gap-1 text-xs text-red-600">
                          <span>⚠ {score.blocker_count}</span>
                        </div>
                      )}
                      {score.momentum && getMomentumIcon(score.momentum)}
                    </div>
                  )}

                  {/* Sub-campaigns count */}
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {subs.length} sous-campagne{subs.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {statusSummary && statusSummary.total > 0 && (
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {statusSummary.completed > 0 && (
                        <Badge variant="secondary" className="text-xs bg-accent/10 text-accent-foreground border-0">
                          {statusSummary.completed} terminée{statusSummary.completed > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {statusSummary.generating > 0 && (
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">
                          {statusSummary.generating} en cours
                        </Badge>
                      )}
                      {statusSummary.draft > 0 && (
                        <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground border-0">
                          {statusSummary.draft} brouillon{statusSummary.draft > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Créé le {format(new Date(campaign.created_at), "d MMM yyyy", { locale: fr })}
                    </span>
                    <span className="text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Voir →
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
