import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useVideoJobPolling } from "@/hooks/useVideoJobPolling";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { ScriptDiffDialog } from "@/components/campaign/ScriptDiffDialog";
import { LandingPageEditor, LandingPageConfig } from "@/components/campaign/LandingPageEditor";
import { EkkoAgent } from "@/components/campaign/EkkoAgent";
import { DealCloseModal } from "@/components/campaign/DealCloseModal";
import { PowerMap } from "@/components/campaign/PowerMap";
import {
  ArrowLeft,
  Play,
  Pause,
  Copy,
  ExternalLink,
  Eye,
  MousePointerClick,
  Clock,
  Users,
  TrendingUp,
  Share2,
  Download,
  Video,
  Pencil,
  Building2,
  Layers,
  ChevronRight,
  Plus,
  AlertTriangle,
  Save,
  Send,
  CheckCircle2,
  History,
  FileText,
  MessageSquare,
  GitCompareArrows,
  
  Globe,
  RefreshCw,
  Zap,
  Sparkles,
} from "lucide-react";
import { EkkoLoader } from "@/components/ui/EkkoLoader";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import type { Campaign, Video as VideoType, Recipient } from "@/types/database";

const DEMO_VIDEO_PATTERNS = [
  "commondatastorage.googleapis.com",
  "sample/BigBuckBunny",
  "sample/ForBigger",
];

function isDemoUrl(url: string): boolean {
  return DEMO_VIDEO_PATTERNS.some((p) => url.includes(p));
}

function getVideoUrl(video?: VideoType | null): string | null {
  if (!video) return null;
  const metadata = video.metadata as Record<string, unknown> | null;
  // Prioritize direct video files (MP4) over hosted pages or HLS streams
  const candidates = [
    metadata?.download_url as string | undefined,
    video.storage_path?.startsWith("http") ? video.storage_path : undefined,
    metadata?.stream_url as string | undefined,
    metadata?.hosted_url as string | undefined,
  ];
  const url = candidates.find(Boolean) ?? null;
  if (url && isDemoUrl(url)) return null;
  // Filter out non-embeddable URLs (Tavus hosted pages)
  if (url && url.includes("tavus.video/")) return null;
  return url;
}

interface ViewEvent {
  id: string;
  video_id: string;
  viewer_hash: string;
  viewed_at: string;
  viewer_email: string | null;
  referred_by_hash: string | null;
}

interface WatchProgressRow {
  id: string;
  video_id: string;
  viewer_hash: string;
  watch_percentage: number;
  max_percentage_reached: number;
  total_watch_seconds: number;
  session_count: number;
  viewer_name: string | null;
  viewer_email: string | null;
  referred_by_hash: string | null;
  first_watched_at: string;
  last_watched_at: string;
}

function computeKpis(viewEvents: ViewEvent[], watchProgress: WatchProgressRow[]) {
  const totalViews = viewEvents.length;
  const uniqueViewers = new Set(watchProgress.map((w) => w.viewer_hash)).size;
  const avgWatchTime =
    watchProgress.length > 0
      ? Math.round(watchProgress.reduce((s, w) => s + w.total_watch_seconds, 0) / watchProgress.length)
      : 0;
  const completionRate =
    watchProgress.length > 0
      ? Math.round((watchProgress.filter((w) => w.max_percentage_reached >= 90).length / watchProgress.length) * 100)
      : 0;
  const shareCount = new Set(watchProgress.filter((w) => w.referred_by_hash).map((w) => w.referred_by_hash)).size;
  const totalSessions = watchProgress.reduce((s, w) => s + w.session_count, 0);
  const avgSessions = watchProgress.length > 0 ? +(totalSessions / watchProgress.length).toFixed(1) : 0;
  const avgMaxReached =
    watchProgress.length > 0
      ? Math.round(watchProgress.reduce((s, w) => s + w.max_percentage_reached, 0) / watchProgress.length)
      : 0;
  const bounceRate =
    watchProgress.length > 0
      ? Math.round((watchProgress.filter((w) => w.max_percentage_reached < 10).length / watchProgress.length) * 100)
      : 0;
  return { totalViews, uniqueViewers, avgWatchTime, completionRate, shareCount, totalSessions, avgSessions, avgMaxReached, bounceRate };
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { membership } = useAuthContext();

  const [isLoading, setIsLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [subCampaigns, setSubCampaigns] = useState<Campaign[]>([]);
  const [videos, setVideos] = useState<(VideoType & { recipient?: Recipient })[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [landingPageConfig, setLandingPageConfig] = useState<Record<string, unknown> | undefined>();
  const [viewEvents, setViewEvents] = useState<ViewEvent[]>([]);
  const [watchProgress, setWatchProgress] = useState<WatchProgressRow[]>([]);
  const [rejectionComment, setRejectionComment] = useState<string | null>(null);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [editedScript, setEditedScript] = useState("");
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [scriptSaved, setScriptSaved] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [scriptVersions, setScriptVersions] = useState<any[]>([]);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [showLandingPageEditor, setShowLandingPageEditor] = useState(false);
  const [showAgent, setShowAgent] = useState(false);
  const [showDealClose, setShowDealClose] = useState(false);
  const [dealScore, setDealScore] = useState<any>(null);
  const [viewers, setViewers] = useState<any[]>([]);
  // Sub-campaign analytics (for parent view)
  const [subAnalytics, setSubAnalytics] = useState<
    Record<string, { viewEvents: ViewEvent[]; watchProgress: WatchProgressRow[] }>
  >({});

  const isParent = campaign && !campaign.parent_campaign_id && subCampaigns.length > 0;

  // Video generation polling
  const {
    jobs: videoJobs,
    isPolling: isVideoPolling,
    hasActiveJobs,
    completedCount: jobsCompleted,
    failedCount: jobsFailed,
    totalCount: jobsTotal,
    progressPercent: jobsProgress,
    refetch: refetchJobs,
  } = useVideoJobPolling({
    campaignId: id,
    orgId: membership?.org_id,
    enabled: !!campaign && ["generating", "approved"].includes(campaign?.status || ""),
  });

  // Auto-refresh campaign data when all jobs finish
  const prevHasActiveRef = useRef(hasActiveJobs);
  useEffect(() => {
    if (prevHasActiveRef.current && !hasActiveJobs && jobsTotal > 0) {
      // Jobs just finished — reload campaign & videos
      const refreshData = async () => {
        if (!id || !membership?.org_id) return;
        const [campRes, vidRes] = await Promise.all([
          supabase.from("campaigns").select("*, identities(display_name, type)").eq("id", id).single(),
          supabase.from("videos").select("*, recipients(first_name, last_name, email, company)").eq("campaign_id", id).eq("org_id", membership.org_id),
        ]);
        if (campRes.data) setCampaign(campRes.data as Campaign);
        if (vidRes.data) setVideos(vidRes.data as (VideoType & { recipient?: Recipient })[]);
        toast.success("Génération vidéo terminée !");
      };
      refreshData();
    }
    prevHasActiveRef.current = hasActiveJobs;
  }, [hasActiveJobs, jobsTotal, id, membership?.org_id]);

  useEffect(() => {
    const fetchCampaign = async () => {
      if (!id || !membership?.org_id) return;

      try {
        // Fetch campaign with identity
        const { data: campaignData, error: campaignError } = await supabase
          .from("campaigns")
          .select("*, identities(display_name, type)")
          .eq("id", id)
          .eq("org_id", membership.org_id)
          .single();

        if (campaignError) throw campaignError;
        setCampaign(campaignData as Campaign);

        const metadata = campaignData.metadata as Record<string, unknown> | null;
        if (metadata?.landingPageConfig) {
          setLandingPageConfig(metadata.landingPageConfig as Record<string, unknown>);
        }

        // Fetch sub-campaigns
        const { data: subData } = await supabase
          .from("campaigns")
          .select("*, identities(display_name)")
          .eq("parent_campaign_id", id)
          .eq("org_id", membership.org_id)
          .order("created_at", { ascending: true });

        const subs = (subData || []) as Campaign[];
        setSubCampaigns(subs);

        // Determine which campaign IDs to fetch analytics for
        const allCampaignIds = subs.length > 0 ? [id, ...subs.map((s) => s.id)] : [id];

        // Fetch all videos for this campaign + sub-campaigns
        const { data: videosData } = await supabase
          .from("videos")
          .select("*, recipients(first_name, last_name, email, company)")
          .in("campaign_id", allCampaignIds)
          .eq("org_id", membership.org_id);

        setVideos((videosData || []) as (VideoType & { recipient?: Recipient })[]);

        // Fetch analytics
        const videoIds = (videosData || []).map((v: { id: string }) => v.id);
        if (videoIds.length > 0) {
          const [viewEventsRes, watchProgressRes] = await Promise.all([
            supabase.from("view_events").select("*").in("video_id", videoIds),
            supabase.from("watch_progress").select("*").in("video_id", videoIds),
          ]);

          const allViewEvents = (viewEventsRes.data || []) as ViewEvent[];
          const allWatchProgress = (watchProgressRes.data || []) as WatchProgressRow[];

          setViewEvents(allViewEvents);
          setWatchProgress(allWatchProgress);

          // Build per-sub-campaign analytics
          if (subs.length > 0) {
            const subRecord: Record<string, { viewEvents: ViewEvent[]; watchProgress: WatchProgressRow[] }> = {};

            for (const sub of subs) {
              const subVideoIds = (videosData || [])
                .filter((v: any) => v.campaign_id === sub.id)
                .map((v: any) => v.id);
              const subViewEvents = allViewEvents.filter((e) => subVideoIds.includes(e.video_id));
              const subWatchProgress = allWatchProgress.filter((w) => subVideoIds.includes(w.video_id));
              subRecord[sub.id] = { viewEvents: subViewEvents, watchProgress: subWatchProgress };
            }
            setSubAnalytics(subRecord);
          }
        }

        // Fetch rejection comment if campaign is draft (was rejected)
        if (campaignData.status === "draft") {
          const { data: rejectionData } = await supabase
            .from("approval_requests")
            .select("decision_comment, decided_at")
            .eq("campaign_id", id)
            .eq("status", "rejected")
            .order("decided_at", { ascending: false })
            .limit(1);
          if (rejectionData && rejectionData.length > 0 && rejectionData[0].decision_comment) {
            setRejectionComment(rejectionData[0].decision_comment);
          }
        }

        // Fetch script versions
        const { data: versionsData } = await supabase
          .from("script_versions")
          .select("*")
          .eq("campaign_id", id)
          .order("version_number", { ascending: false });
        setScriptVersions(versionsData || []);

        // Fetch deal score + viewers for agent
        const [dealScoreRes, viewersRes] = await Promise.all([
          supabase.from("deal_scores").select("*").eq("campaign_id", id).order("scored_at", { ascending: false }).limit(1),
          supabase.from("viewers").select("*").eq("campaign_id", id).order("contact_score", { ascending: false, nullsFirst: false }),
        ]);
        if (dealScoreRes.data?.[0]) setDealScore(dealScoreRes.data[0]);
        if (viewersRes.data) setViewers(viewersRes.data);
      } catch {
        console.error("Fetch campaign failed");
        toast.error("Erreur lors du chargement de la campagne");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaign();
  }, [id, membership?.org_id]);

  const kpis = useMemo(() => computeKpis(viewEvents, watchProgress), [viewEvents, watchProgress]);

  const handleSaveLandingPageConfig = async (config: Record<string, unknown>) => {
    if (!campaign || !membership?.org_id) return;
    try {
      const currentMetadata = (campaign.metadata || {}) as Record<string, unknown>;
      const updatedMetadata = JSON.parse(
        JSON.stringify({ ...currentMetadata, landingPageConfig: config })
      );
      const { error } = await supabase
        .from("campaigns")
        .update({ metadata: updatedMetadata })
        .eq("id", campaign.id)
        .eq("org_id", membership.org_id);
      if (error) throw error;
      setLandingPageConfig(config);
      setCampaign((prev) => (prev ? { ...prev, metadata: updatedMetadata } : null));
    } catch {
      console.error("Save landing page config failed");
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const handleSaveScript = async () => {
    if (!campaign || !membership?.org_id || !editedScript.trim()) return;
    setIsSavingScript(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ script: editedScript })
        .eq("id", campaign.id);
      if (error) throw error;

      // Save script version
      const nextVersion = scriptVersions.length > 0
        ? Math.max(...scriptVersions.map((v: any) => v.version_number)) + 1
        : 1;
      const { data: newVersion } = await supabase
        .from("script_versions")
        .insert({
          campaign_id: campaign.id,
          org_id: membership.org_id,
          version_number: nextVersion,
          script: editedScript,
          change_reason: rejectionComment ? "rejection_revision" : "manual_edit",
          rejection_comment: rejectionComment || null,
          created_by_user_id: membership.user_id || null,
        })
        .select()
        .single();
      if (newVersion) {
        setScriptVersions((prev) => [newVersion, ...prev]);
      }

      setCampaign((prev) => (prev ? { ...prev, script: editedScript } : null));
      setIsEditingScript(false);
      setScriptSaved(true);
      toast.success("Script mis à jour — vous pouvez maintenant resoumettre");
    } catch {
      console.error("Save script failed");
      toast.error("Erreur lors de la sauvegarde du script");
    } finally {
      setIsSavingScript(false);
    }
  };

  const handleResubmit = async () => {
    if (!campaign || !membership?.org_id) return;
    setIsResubmitting(true);
    try {
      // Update campaign status to pending_approval
      const { error: statusError } = await supabase
        .from("campaigns")
        .update({ status: "pending_approval" })
        .eq("id", campaign.id);
      if (statusError) throw statusError;

      // Create new approval request
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", membership.user_id || "")
        .single();

      // Find the identity owner (exec) to assign approval
      const { data: identity } = await supabase
        .from("identities")
        .select("owner_user_id")
        .eq("id", campaign.identity_id)
        .single();

      const { error: approvalError } = await supabase
        .from("approval_requests")
        .insert({
          org_id: membership.org_id,
          campaign_id: campaign.id,
          requested_by_user_id: membership.user_id || null,
          assigned_to_user_id: identity?.owner_user_id || null,
          status: "pending",
          script_snapshot: campaign.script,
        });
      if (approvalError) throw approvalError;

      // Trigger notification
      try {
        await supabase.functions.invoke("notify-approval", {
          body: { campaign_id: campaign.id },
        });
      } catch {
        console.warn("Notification failed (non-blocking)");
      }

      setCampaign((prev) => (prev ? { ...prev, status: "pending_approval" } : null));
      setRejectionComment(null);
      setScriptSaved(false);
      toast.success("Campagne resoumise pour approbation");
    } catch {
      console.error("Resubmit failed");
      toast.error("Erreur lors de la resoumission");
    } finally {
      setIsResubmitting(false);
    }
  };

  const landingPageUrl = id ? `${window.location.origin}/lp/${id}` : "";

  const generateShareLink = () => {
    return landingPageUrl;
  };

  const copyShareLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Lien copié dans le presse-papier");
  };

  const handleVideoToggle = () => {
    const video = document.getElementById("campaign-video") as HTMLVideoElement;
    if (video) {
      if (isPlaying) video.pause();
      else video.play();
      setIsPlaying(!isPlaying);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Chargement...</div>
        </div>
      </AppLayout>
    );
  }

  if (!campaign) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Campagne non trouvée</p>
          <Button variant="outline" onClick={() => navigate("/app/campaigns")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            ← Deals
          </Button>
        </div>
      </AppLayout>
    );
  }

  const shareLink = generateShareLink();

  // ─── PARENT CAMPAIGN (ACCOUNT) VIEW ────────────────────────────────
  if (isParent) {
    return (
      <AppLayout>
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/app/campaigns')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Deals
          </button>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
                  <Badge variant="outline" className="text-xs">
                    <Layers className="mr-1 h-3 w-3" />
                    {subCampaigns.length} sous-campagne{subCampaigns.length > 1 ? "s" : ""}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {(campaign as any).identities?.display_name || "Identité"} • Créé le{" "}
                  {format(new Date(campaign.created_at), "d MMMM yyyy", { locale: fr })}
                </p>
                {campaign.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exporter
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          </TabsList>

          {/* Overview: Aggregated KPIs + Sub-campaign cards */}
          <TabsContent value="overview" className="space-y-6">
            {/* Aggregate KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={Eye} value={kpis.totalViews.toLocaleString()} label="Ouvertures" />
              <MetricCard icon={Users} value={kpis.uniqueViewers.toLocaleString()} label="Contacts identifiés" />
              <MetricCard icon={Clock} value={`${kpis.avgWatchTime}s`} label="Attention moyenne" />
              <MetricCard icon={TrendingUp} value={`${kpis.completionRate}%`} label="Taux de complétion" />
            </div>

            {/* Sub-campaigns grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Sous-campagnes</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {subCampaigns.map((sub) => {
                  const subData = subAnalytics[sub.id];
                  const subKpis = subData ? computeKpis(subData.viewEvents, subData.watchProgress) : null;
                  const subVideos = videos.filter((v) => v.campaign_id === sub.id);

                  return (
                    <Card
                      key={sub.id}
                      className="cursor-pointer group hover:shadow-md transition-all hover:border-primary/30"
                      onClick={() => navigate(`/app/campaigns/${sub.id}`)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {sub.name}
                            </h3>
                            {sub.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sub.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={sub.status} />
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>

                        {/* Mini stats */}
                        {subKpis && (
                          <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t">
                            <div className="text-center">
                              <p className="text-lg font-bold text-foreground">{subKpis.totalViews}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vues</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-foreground">{subKpis.uniqueViewers}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Viewers</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-foreground">{subKpis.completionRate}%</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Complétion</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-foreground">{subKpis.shareCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Partages</p>
                            </div>
                          </div>
                        )}

                        {/* Progress bar */}
                        {subKpis && subKpis.avgMaxReached > 0 && (
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>Progression moyenne</span>
                              <span>{subKpis.avgMaxReached}%</span>
                            </div>
                            <Progress value={subKpis.avgMaxReached} className="h-1.5" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </AppLayout>
    );
  }

  // ─── SUB-CAMPAIGN / STANDALONE CAMPAIGN DETAIL ─────────────────────
  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/campaigns')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Deals
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="mt-1 text-muted-foreground">
              {(campaign as any).identities?.display_name || "Identité"} • Créée le{" "}
              {format(new Date(campaign.created_at), "d MMMM yyyy", { locale: fr })}
            </p>
          </div>
           <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAgent(!showAgent)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Agent Ekko
            </Button>
            <Button variant="outline" onClick={() => setShowDealClose(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Clôturer
            </Button>
            <Button variant="outline" onClick={() => setShowLandingPageEditor(true)}>
              <Globe className="mr-2 h-4 w-4" />
              Landing page
            </Button>
            <Button onClick={() => { copyShareLink(shareLink); }}>
              <Share2 className="mr-2 h-4 w-4" />
              Copier le lien
            </Button>
          </div>
        </div>

        {/* Deal Progress Bar */}
        {(() => {
          const statusSteps = ["draft", "pending_approval", "approved", "generating", "completed"];
          const statusLabels: Record<string, string> = { draft: "Brouillon", pending_approval: "Validation", approved: "Approuvé", generating: "Génération", completed: "Vidéo prête" };
          const currentIdx = statusSteps.indexOf(campaign.status);
          const progressPct = currentIdx >= 0 ? ((currentIdx + 1) / statusSteps.length) * 100 : 0;
          return (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                {statusSteps.map((s, i) => (
                  <span key={s} className={cn("font-medium", i <= currentIdx ? "text-primary" : "")}>
                    {statusLabels[s]}
                  </span>
                ))}
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
          );
        })()}
      </div>

      {/* Next Best Action */}
      {dealScore?.recommended_action && (
        <div className="border-l-4 border-signal rounded-lg p-4 bg-signal/5 mb-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-signal/10">
            <Zap className="h-5 w-5 text-signal" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Next Best Action</p>
            <p className="text-sm font-medium text-foreground">{(dealScore.recommended_action as any).label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Coût d'exécution : {(dealScore.recommended_action as any).cost}</p>
          </div>
          <Button
            size="sm"
            variant={(dealScore.recommended_action as any).priority === "high" ? "default" : "outline"}
            onClick={() => { setShowAgent(true); }}
          >
            <MessageSquare className="mr-2 h-3.5 w-3.5" />
            Demander à l'agent
          </Button>
        </div>
      )}

      {(hasActiveJobs || (jobsTotal > 0 && ["generating", "approved"].includes(campaign.status))) && (
        <Alert className="mb-6 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3">
            {hasActiveJobs ? (
              <EkkoLoader mode="loop" size={24} />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            )}
            <div className="flex-1">
              <AlertTitle className="font-semibold text-foreground">
                {hasActiveJobs
                  ? "Génération vidéo en cours..."
                  : jobsFailed > 0
                    ? "Génération terminée avec des erreurs"
                    : "Génération terminée ✓"}
              </AlertTitle>
              <AlertDescription className="mt-1">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {jobsCompleted}/{jobsTotal} vidéo{jobsTotal > 1 ? "s" : ""} terminée{jobsCompleted > 1 ? "s" : ""}
                    {jobsFailed > 0 && (
                      <span className="text-destructive ml-1">• {jobsFailed} erreur{jobsFailed > 1 ? "s" : ""}</span>
                    )}
                  </span>
                  {isVideoPolling && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Actualisation auto
                    </span>
                  )}
                </div>
                <Progress value={jobsProgress} className="h-2 mt-2" />
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Rejection Alert */}
      {rejectionComment && campaign.status === "draft" && (
        <Alert variant="destructive" className="mb-6 border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-semibold">Script refusé — modifier et resoumettre</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm italic mb-3">« {rejectionComment} »</p>
            {!isEditingScript ? (
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setEditedScript(campaign.script);
                  setIsEditingScript(true);
                }}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Modifier le script
              </Button>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  className="min-h-[120px] bg-background"
                  placeholder="Modifiez votre script ici..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveScript} disabled={isSavingScript}>
                    <Save className="mr-2 h-3.5 w-3.5" />
                    {isSavingScript ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingScript(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}
            {scriptSaved && !isEditingScript && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  Script modifié
                </div>
                <Button
                  size="sm"
                  onClick={handleResubmit}
                  disabled={isResubmitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="mr-2 h-3.5 w-3.5" />
                  {isResubmitting ? "Resoumission..." : "Resoumettre pour approbation"}
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="intelligence">Deal Intelligence</TabsTrigger>
          <TabsTrigger value="video">Vidéo</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
             <MetricCard icon={Eye} value={kpis.totalViews.toLocaleString()} label="Ouvertures" />
             <MetricCard icon={Users} value={kpis.uniqueViewers.toLocaleString()} label="Contacts identifiés" />
             <MetricCard icon={Clock} value={`${kpis.avgWatchTime}s`} label="Attention moyenne" />
             <MetricCard icon={TrendingUp} value={`${kpis.completionRate}%`} label="Taux de complétion" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Video Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Aperçu vidéo
                </CardTitle>
                <CardDescription>Vidéo générée pour cette campagne</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                {(() => {
                  const url = getVideoUrl(videos.find((v) => v.campaign_id === id));
                  return url ? (
                    <>
                      <video
                        id="campaign-video"
                        src={url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        controls
                      />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <Video className="h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-muted-foreground">Vidéo en cours de préparation</p>
                    </div>
                  );
                })()}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1">
                    <Input value={shareLink} readOnly className="font-mono text-sm" />
                  </div>
                  <Button variant="outline" size="icon" onClick={() => copyShareLink(shareLink)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => window.open(shareLink, "_blank")}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Script */}
            <Card>
              <CardHeader>
                <CardTitle>Script de la campagne</CardTitle>
                <CardDescription>Le texte utilisé pour générer la vidéo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 min-h-[200px]">
                  <p className="text-sm whitespace-pre-wrap">{campaign.script || "Aucun script défini"}</p>
                </div>
                {campaign.description && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <p className="text-sm font-medium mb-2">Description</p>
                      <p className="text-sm text-muted-foreground">{campaign.description}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Script Version History */}
          {scriptVersions.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Historique des versions du script
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    {scriptVersions.length} version{scriptVersions.length > 1 ? "s" : ""} enregistrée{scriptVersions.length > 1 ? "s" : ""}
                  </CardDescription>
                </div>
                {scriptVersions.length >= 2 && (
                  <Button variant="outline" size="sm" onClick={() => setShowDiffDialog(true)}>
                    <GitCompareArrows className="mr-2 h-4 w-4" />
                    Comparer
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                  
                  <div className="space-y-6">
                    {scriptVersions.map((version, idx) => {
                      const isLatest = idx === 0;
                      const isRejectionRevision = version.change_reason === "rejection_revision";
                      return (
                        <div key={version.id} className="relative pl-10">
                          {/* Timeline dot */}
                          <div className={cn(
                            "absolute left-[8px] top-1 h-[15px] w-[15px] rounded-full border-2",
                            isLatest
                              ? "bg-primary border-primary"
                              : isRejectionRevision
                                ? "bg-destructive/20 border-destructive/50"
                                : "bg-muted border-muted-foreground/30"
                          )} />
                          
                          <div className={cn(
                            "rounded-lg border p-4",
                            isLatest && "border-primary/30 bg-primary/5"
                          )}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={isLatest ? "default" : "secondary"} className="text-xs">
                                  v{version.version_number}
                                </Badge>
                                {isLatest && (
                                  <span className="text-xs font-medium text-primary">Version actuelle</span>
                                )}
                                {isRejectionRevision && (
                                  <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                                    <MessageSquare className="mr-1 h-3 w-3" />
                                    Révision après rejet
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(version.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                              </span>
                            </div>
                            
                            {/* Rejection comment */}
                            {version.rejection_comment && (
                              <div className="mb-3 p-2.5 rounded-md bg-destructive/5 border border-destructive/15">
                                <p className="text-xs font-medium text-destructive mb-0.5">Commentaire de l'exécutif :</p>
                                <p className="text-sm italic text-destructive/80">« {version.rejection_comment} »</p>
                              </div>
                            )}
                            
                            {/* Script preview */}
                            <div className="bg-muted/50 rounded-md p-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">Script</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap line-clamp-4">{version.script}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Deal Intelligence Tab */}
        <TabsContent value="intelligence" className="space-y-6">
          {/* DES + Momentum + Cold Start */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
             <MetricCard icon={Zap} value={dealScore?.des ?? "—"} label="Deal Engagement Score" />
             <MetricCard icon={Users} value={viewers.length.toString()} label="Contacts identifiés" />
             <MetricCard icon={TrendingUp} value={dealScore?.sponsor_count ?? 0} label="Contacts sponsors" />
             <MetricCard icon={AlertTriangle} value={dealScore?.blocker_count ?? 0} label="Bloqueurs potentiels" />
             <MetricCard icon={Eye} value={`${Math.round((dealScore?.avg_watch_depth ?? 0) * 100) / 100}%`} label="Profondeur d'engagement" />
          </div>

          {/* Momentum + Cold Start */}
          <div className="grid gap-4 md:grid-cols-2">
            {dealScore?.momentum && (
              <Card>
                <CardContent className="pt-6 flex items-center gap-4">
                  {dealScore.momentum === "rising" ? <TrendingUp className="h-8 w-8 text-emerald-600" /> :
                   dealScore.momentum === "declining" ? <TrendingUp className="h-8 w-8 text-red-600 rotate-180" /> :
                   <TrendingUp className="h-8 w-8 text-amber-600" />}
                  <div>
                    <p className="font-semibold text-foreground">Momentum : {dealScore.momentum === "rising" ? "En hausse ↑" : dealScore.momentum === "declining" ? "En baisse ↓" : "Stable →"}</p>
                    <p className="text-sm text-muted-foreground">Velocity : {dealScore.event_velocity ?? 0} events/jour • Multi-threading : {dealScore.multi_threading_score ?? 0}/100</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {dealScore?.cold_start_regime && (
              <Card>
                <CardContent className="pt-6 flex items-center gap-4">
                  <Sparkles className="h-8 w-8 text-amber-600" />
                  <div>
                    <p className="font-semibold text-foreground">
                      Régime : {dealScore.cold_start_regime === "cold_global" ? "Cold Global" :
                        dealScore.cold_start_regime === "cold_account" ? "Cold Account" :
                        dealScore.cold_start_regime === "warm_account" ? "Warm Account" : "Mature"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {dealScore.cold_start_regime === "cold_global" ? "Heuristiques génériques — fiabilité limitée" :
                        dealScore.cold_start_regime === "cold_account" ? "Benchmarks industrie" :
                        dealScore.cold_start_regime === "warm_account" ? "Patterns compte activés" : "Insights complets"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Alerts */}
          {dealScore?.alerts && Array.isArray(dealScore.alerts) && (dealScore.alerts as any[]).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Alertes</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(dealScore.alerts as any[]).map((a: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg border text-sm ${
                    a.type === "danger" ? "bg-red-500/10 border-red-500/20 text-red-700" :
                    a.type === "warning" ? "bg-amber-500/10 border-amber-500/20 text-amber-700" :
                    "bg-blue-500/10 border-blue-500/20 text-blue-700"
                  }`}>
                    {a.text}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Power Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Power Map
              </CardTitle>
              <CardDescription>Cartographie des interactions et de l'influence du buying committee</CardDescription>
            </CardHeader>
            <CardContent>
              <PowerMap campaignId={campaign.id} orgId={membership?.org_id || ""} />
            </CardContent>
          </Card>

          {/* No data state */}
          {!dealScore && viewers.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Aucune donnée de deal intelligence disponible</p>
                <p className="text-sm text-muted-foreground mt-1">Partagez la landing page pour commencer à collecter des signaux</p>
              </CardContent>
            </Card>
          )}

        </TabsContent>

        {/* Video Tab */}
        <TabsContent value="video" className="space-y-6">
          {/* Job Status List */}
          {videoJobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {hasActiveJobs ? <EkkoLoader mode="loop" size={20} /> : <Video className="h-5 w-5" />}
                  Statut de génération
                </CardTitle>
                <CardDescription>
                  {jobsCompleted}/{jobsTotal} vidéo{jobsTotal > 1 ? "s" : ""} prête{jobsCompleted > 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {videoJobs.map((job) => {
                    const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
                      queued: { label: "En file d'attente", color: "text-muted-foreground", icon: <Clock className="h-4 w-4" /> },
                      processing: { label: "En cours", color: "text-primary", icon: <EkkoLoader mode="loop" size={16} /> },
                      completed: { label: "Terminée", color: "text-primary", icon: <CheckCircle2 className="h-4 w-4" /> },
                      failed: { label: "Échouée", color: "text-destructive", icon: <AlertTriangle className="h-4 w-4" /> },
                    };
                    const cfg = statusConfig[job.status] || statusConfig.queued;
                    return (
                      <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <div className={cfg.color}>{cfg.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            Destinataire #{job.recipient_id.slice(0, 8)}
                          </p>
                          <p className={cn("text-xs", cfg.color)}>{cfg.label}</p>
                        </div>
                        {job.error_message && (
                          <p className="text-xs text-destructive max-w-[200px] truncate" title={job.error_message}>
                            {job.error_message}
                          </p>
                        )}
                        {job.started_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(job.started_at), "HH:mm", { locale: fr })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Vidéo de la campagne</CardTitle>
              <CardDescription>Vidéo personnalisée générée par IA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-3xl mx-auto">
                {(() => {
                  const url = getVideoUrl(videos.find((v) => v.campaign_id === id));
                  if (!url) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <Video className="h-12 w-12 text-muted-foreground/40" />
                        <p className="font-medium text-foreground">
                          {campaign.status === 'generating' ? 'Génération en cours...' :
                           campaign.status === 'pending_approval' ? "En attente d'approbation" :
                           'Vidéo en cours de préparation'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {campaign.status === 'generating' ?
                            'La vidéo apparaîtra ici automatiquement dès qu\'elle est prête.' :
                            'La vidéo sera générée dès que le script sera approuvé.'}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                        <video
                          src={url}
                          className="w-full h-full"
                          controls
                          preload="metadata"
                        />
                      </div>
                      <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-center">
                        <div className="flex-1 max-w-md">
                          <label className="text-sm font-medium mb-2 block">Lien de partage</label>
                          <div className="flex gap-2">
                            <Input value={shareLink} readOnly className="font-mono text-sm" />
                            <Button variant="outline" onClick={() => copyShareLink(shareLink)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copier
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>

      {/* Ekko Agent Panel */}
      {showAgent && (
        <div className="fixed inset-y-0 right-0 w-full max-w-2xl z-50 shadow-2xl border-l bg-card">
          <EkkoAgent
            campaignId={campaign.id}
            campaignName={campaign.name}
            viewers={viewers}
            dealScore={dealScore}
            onClose={() => setShowAgent(false)}
          />
        </div>
      )}

      {/* Deal Close Modal */}
      <DealCloseModal
        open={showDealClose}
        onOpenChange={setShowDealClose}
        campaignId={campaign.id}
        campaignName={campaign.name}
      />

      {scriptVersions.length >= 2 && (
        <ScriptDiffDialog
          open={showDiffDialog}
          onOpenChange={setShowDiffDialog}
          versions={scriptVersions}
        />
      )}

      <LandingPageEditor
        open={showLandingPageEditor}
        onOpenChange={setShowLandingPageEditor}
        campaignId={campaign.id}
        campaignName={campaign.name}
        videoUrl={getVideoUrl(videos.find((v) => v.campaign_id === id)) || ""}
        orgId={membership?.org_id || ""}
        initialConfig={landingPageConfig as unknown as LandingPageConfig | undefined}
        onSave={(config) => handleSaveLandingPageConfig(config as unknown as Record<string, unknown>)}
      />
    </AppLayout>
  );
}
