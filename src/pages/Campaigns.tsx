import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { canSeeAllDeals } from "@/lib/roles";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, LayoutList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Campaign } from "@/types/database";
import { DealRiskBadge } from "@/components/ui/DealRiskBadge";
import { cn } from "@/lib/utils";

interface DealScoreRow {
  campaign_id: string;
  des: number | null;
  momentum: string | null;
  viewer_count: number | null;
  sponsor_count: number | null;
  blocker_count: number | null;
  alerts: any;
  risk_level: string | null;
  priority_score: number | null;
}

interface ViewerSummary {
  campaign_id: string;
  name: string | null;
  email: string | null;
  contact_score: number | null;
}

interface LastEventRow {
  campaign_id: string;
  event_type: string;
}

// ─── Qualified activity labels ──────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  doc_page_viewed: "Pricing consulté",
  video_watched: "Vidéo regardée",
  share: "Partage interne détecté",
  new_viewer: "Nouveau contact détecté",
  declared: "Signal offline ajouté",
};

function getQualifiedActivity(eventType: string | undefined): string | null {
  if (!eventType) return null;
  return EVENT_LABELS[eventType] || null;
}

// ─── Status label mapping ───────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  draft: "En préparation",
  active: "En cours",
  observing: "Actif",
  snoozed: "En veille",
  closed: "Clôturé",
  generating: "En cours",
  pending_approval: "En cours",
  approved: "En cours",
  sent: "En cours",
};

export default function Campaigns() {
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dealScores, setDealScores] = useState<Record<string, DealScoreRow>>({});
  const [viewers, setViewers] = useState<Record<string, ViewerSummary[]>>({});
  const [lastEvents, setLastEvents] = useState<Record<string, string>>({});
  const [pendingApprovals, setPendingApprovals] = useState<Set<string>>(new Set());
  const [showClosed, setShowClosed] = useState(false);

  const navigate = useNavigate();
  const { user, membership } = useAuthContext();
  const userRole = membership?.role || "org_user";

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!membership?.org_id) return;

      try {
        let query = supabase
          .from("campaigns")
          .select("*, identities(display_name)")
          .eq("org_id", membership.org_id)
          .is("parent_campaign_id", null)
          .order("created_at", { ascending: false });

        if (!canSeeAllDeals(userRole)) {
          query = query.eq("created_by_user_id", user.id);
        }

        const { data, error } = await query;

        if (error) throw error;
        const campaignList = (data as Campaign[]) || [];
        setCampaigns(campaignList);

        const campaignIds = campaignList.map((c) => c.id);
        if (campaignIds.length > 0) {
          // Fetch scores
          const { data: scores } = await supabase
            .from("deal_scores")
            .select("campaign_id, des, momentum, viewer_count, sponsor_count, blocker_count, alerts, risk_level, priority_score")
            .in("campaign_id", campaignIds)
            .order("scored_at", { ascending: false });

          if (scores) {
            const scoreMap: Record<string, DealScoreRow> = {};
            for (const s of scores as DealScoreRow[]) {
              if (!scoreMap[s.campaign_id]) scoreMap[s.campaign_id] = s;
            }
            setDealScores(scoreMap);
          }

          // Fetch viewers for avatars
          const { data: viewerData } = await supabase
            .from("viewers")
            .select("campaign_id, name, email, contact_score")
            .in("campaign_id", campaignIds)
            .order("contact_score", { ascending: false });

          if (viewerData) {
            const viewerMap: Record<string, ViewerSummary[]> = {};
            viewerData.forEach((v: any) => {
              if (!viewerMap[v.campaign_id]) viewerMap[v.campaign_id] = [];
              viewerMap[v.campaign_id].push(v);
            });
            setViewers(viewerMap);
          }

          // Fetch last significant event per campaign
          const { data: eventData } = await supabase
            .from("timeline_events")
            .select("campaign_id, event_type")
            .in("campaign_id", campaignIds)
            .in("event_type", Object.keys(EVENT_LABELS))
            .order("created_at", { ascending: false });

          if (eventData) {
            const eventMap: Record<string, string> = {};
            eventData.forEach((e: any) => {
              if (!eventMap[e.campaign_id]) eventMap[e.campaign_id] = e.event_type;
            });
            setLastEvents(eventMap);
          }

          // Fetch pending approvals
          const { data: approvalData } = await supabase
            .from("approval_requests")
            .select("campaign_id")
            .in("campaign_id", campaignIds)
            .eq("status", "pending");

          if (approvalData) {
            setPendingApprovals(new Set(approvalData.map((a: any) => a.campaign_id)));
          }
        }
      } catch { console.error("Fetch campaigns failed"); }
      finally { setIsLoading(false); }
    };

    fetchCampaigns();
  }, [membership?.org_id, userRole, user.id]);

  const sortedCampaigns = useMemo(() => {
    let filtered = campaigns.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Hide closed deals unless toggled
    if (!showClosed) {
      filtered = filtered.filter(c => (c as any).deal_status !== 'closed');
    }

    // Sort by priority_score descending
    filtered.sort((a, b) => {
      const prioA = dealScores[a.id]?.priority_score ?? 0;
      const prioB = dealScores[b.id]?.priority_score ?? 0;
      return prioB - prioA;
    });

    return filtered;
  }, [campaigns, searchQuery, dealScores, showClosed]);

  const getDesClass = (des: number | null) => {
    if (des === null) return "des-pill bg-muted text-muted-foreground";
    if (des >= 70) return "des-pill des-pill-high";
    if (des >= 40) return "des-pill des-pill-medium";
    return "des-pill des-pill-low";
  };

  const getAvatarColor = (contactScore: number | null) => {
    if (contactScore === null) return "bg-info";
    if (contactScore > 70) return "bg-signal";
    if (contactScore > 30) return "bg-warning";
    return "bg-destructive";
  };

  const getSignalBadges = (score: DealScoreRow | undefined): string[] => {
    const badges: string[] = [];
    if (!score) return badges;
    if (score.blocker_count && score.blocker_count > 0) badges.push(`${score.blocker_count} bloqueur${score.blocker_count > 1 ? "s" : ""}`);
    if (score.momentum === "declining") badges.push("Decay signal");
    if (score.alerts && Array.isArray(score.alerts)) {
      (score.alerts as any[]).slice(0, 2).forEach((a: any) => {
        if (typeof a === "string") badges.push(a);
        else if (a?.message) badges.push(a.message);
      });
    }
    return badges.slice(0, 3);
  };

  // Check if a deal qualifies for the inline "new signal" badge
  const hasNewSignalBadge = (campaign: Campaign): boolean => {
    const c = campaign as any;
    if (c.first_action_completed_at) return false;
    if (!c.first_signal_at) return false;
    try {
      const signalDate = new Date(c.first_signal_at);
      if (isNaN(signalDate.getTime())) return false;
      const updatedDate = new Date(c.updated_at);
      const lastEventAge = !isNaN(updatedDate.getTime()) ? Date.now() - updatedDate.getTime() : Infinity;
      const signalAge = Date.now() - signalDate.getTime();
      const within48h = 48 * 60 * 60 * 1000;
      return signalAge <= within48h || lastEventAge <= within48h;
    } catch { return false; }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Deals"
        description={canSeeAllDeals(userRole) ? "Tous les deals de l'équipe, triés par urgence." : "Vos deals, triés par urgence. Les signaux rouges en premier."}
        actions={
          <Button onClick={() => navigate("/app/campaigns/new")} className="rounded-cta bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau deal
          </Button>
        }
      />

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un deal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <button
          onClick={() => setShowClosed(prev => !prev)}
          className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
        >
          {showClosed ? "Masquer les deals clôturés" : "Voir les deals clôturés"}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-card rounded-card shadow-card">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-24 ml-auto" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      ) : sortedCampaigns.length === 0 ? (
        <EmptyState
          icon={LayoutList}
          title="Aucun deal"
          description={searchQuery ? "Aucun résultat pour cette recherche" : "Créez votre premier deal"}
          action={searchQuery ? undefined : { label: "Créer un deal", onClick: () => navigate("/app/campaigns/new") }}
          className="py-16"
        />
      ) : (
        <div className="space-y-2">
          {sortedCampaigns.map((campaign, idx) => {
            const score = dealScores[campaign.id];
            const campaignViewers = viewers[campaign.id] || [];
            const signalBadges = getSignalBadges(score);
            const isTopDeal = idx === 0;
            const showNewSignal = hasNewSignalBadge(campaign);
            const qualifiedActivity = getQualifiedActivity(lastEvents[campaign.id]);
            const statusLabel = STATUS_LABELS[campaign.status] || campaign.status;
            const hasPendingApproval = pendingApprovals.has(campaign.id);

            return (
              <div
                key={campaign.id}
                className={cn(
                  "group flex items-center gap-4 rounded-card shadow-card cursor-pointer hover:shadow-lg transition-all bg-card",
                  isTopDeal ? "p-5 border-l-[3px] border-l-[hsl(var(--signal))]" : "p-4 border-l-2 border-l-transparent",
                )}
                onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
              >
                <DealRiskBadge
                  level={(score?.risk_level as 'healthy' | 'watch' | 'critical') || null}
                  reason={score?.risk_level === 'critical' ? 'DES critique ou silence prolongé' :
                          score?.risk_level === 'watch' ? 'Signaux à surveiller' : undefined}
                />

                {/* Deal info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                    {/* Primary status badge */}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {statusLabel}
                    </Badge>
                    {/* Secondary: pending approval micro-badge */}
                    {hasPendingApproval && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30">
                        Approbation en attente
                      </Badge>
                    )}
                    {/* Inline new signal badge */}
                    {showNewSignal && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent border border-accent/30">
                        Nouveau signal · 1 action à traiter
                      </Badge>
                    )}
                    {/* Qualified activity */}
                    {qualifiedActivity && (
                      <span className="text-xs text-muted-foreground">· {qualifiedActivity}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(campaign as any).identities?.display_name || "—"}
                  </p>

                  {/* Signal badges */}
                  {signalBadges.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {signalBadges.map((badge, i) => (
                        <span key={i} className="signal-badge">{badge}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Buying committee avatars */}
                {campaignViewers.length > 0 && (
                  <div className="flex -space-x-1.5 flex-shrink-0">
                    {campaignViewers.slice(0, 5).map((v, i) => (
                      <div
                        key={i}
                        className={`w-[22px] h-[22px] rounded-full ${getAvatarColor(v.contact_score)} border-2 border-card flex items-center justify-center`}
                        title={v.name || v.email || "Inconnu"}
                      >
                        <span className="text-[8px] font-bold text-white">
                          {(v.name || v.email || "?")[0].toUpperCase()}
                        </span>
                      </div>
                    ))}
                    {campaignViewers.length > 5 && (
                      <div className="w-[22px] h-[22px] rounded-full bg-muted border-2 border-card flex items-center justify-center">
                        <span className="text-[8px] font-bold text-muted-foreground">+{campaignViewers.length - 5}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* DES Pill */}
                <div className="flex-shrink-0">
                  <span className={getDesClass(score?.des ?? null)}>
                    {score?.des != null ? score.des : "—"}
                  </span>
                </div>

                <button
                  className='opacity-0 group-hover:opacity-100 transition-opacity text-xs
                    text-muted-foreground hover:text-foreground border rounded-md px-2 py-1'
                  onClick={(e) => { e.stopPropagation(); navigate('/app/agent?deal=' + campaign.id); }}
                >
                  Voir ↗
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
