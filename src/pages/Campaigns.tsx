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
import { Plus, Search, Video, Building2, Layers, Eye, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Campaign } from "@/types/database";

export default function Campaigns() {
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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
        setCampaigns((data as Campaign[]) || []);
      } catch (error) {
        console.error("Fetch campaigns error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [membership?.org_id]);

  // Group: parent campaigns (no parent) with their children
  const parentCampaigns = useMemo(() => {
    const parents = campaigns.filter((c) => !c.parent_campaign_id);
    return parents.map((p) => ({
      ...p,
      sub_campaigns: campaigns.filter((c) => c.parent_campaign_id === p.id),
    }));
  }, [campaigns]);

  // Also include orphan campaigns (old ones without parent) that are not children
  const childIds = new Set(campaigns.filter((c) => c.parent_campaign_id).map((c) => c.id));
  
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

      {/* Search */}
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

      {/* Account Cards */}
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
                    <StatusBadge status={campaign.status} />
                  </div>

                  {/* Description */}
                  {campaign.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {campaign.description}
                    </p>
                  )}

                  {/* Sub-campaigns count */}
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {subs.length} sous-campagne{subs.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Status summary */}
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
