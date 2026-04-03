import { useState, useEffect, useMemo, useCallback, useRef, Component, ErrorInfo, ReactNode } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScriptDiffDialog } from "@/components/campaign/ScriptDiffDialog";
import { LandingPageEditor, LandingPageConfig } from "@/components/campaign/LandingPageEditor";
import { EkkoAgent } from "@/components/campaign/EkkoAgent";
import { DealCloseModal } from "@/components/campaign/DealCloseModal";
import { PowerMap } from "@/components/campaign/PowerMap";
import { NBACard } from "@/components/campaign/NBACard";
import { InsightCard } from "@/components/campaign/InsightCard";
import { DealTimeline } from "@/components/campaign/DealTimeline";
import { WhatHappenedWidget } from "@/components/campaign/WhatHappenedWidget";
import { LayerCoverage } from "@/components/campaign/LayerCoverage";
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
  ChevronDown,
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
  CalendarIcon,
  PauseCircle,
  Info,
} from "lucide-react";
import { EkkoLoader } from "@/components/ui/EkkoLoader";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import type { Campaign, Video as VideoType, Recipient } from "@/types/database";

// ─── Section Error Boundary ─────────────────────────────────────────
interface SectionGuardProps { children: ReactNode; name?: string; }
interface SectionGuardState { hasError: boolean; }

class SectionGuard extends Component<SectionGuardProps, SectionGuardState> {
  state: SectionGuardState = { hasError: false };
  static getDerivedStateFromError(): SectionGuardState { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SectionGuard] ${this.props.name || "section"} crashed:`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
          <Info className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Données indisponibles pour le moment.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Safe date helpers ──────────────────────────────────────────────
function safeDate(value: unknown): Date | null {
  if (!value) return null;
  try {
    const d = new Date(value as string);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

function safeFormatDate(value: unknown, fmt: string, options?: { locale?: Locale }): string {
  const d = safeDate(value);
  if (!d) return "—";
  try { return format(d, fmt, options); } catch { return "—"; }
}

type Locale = typeof fr;

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
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [agentContext, setAgentContext] = useState<any>(null);
  const [snoozeDate, setSnoozeDate] = useState<Date | undefined>();
  // Sub-campaign analytics (for parent view)
  const [subAnalytics, setSubAnalytics] = useState<
    Record<string, { viewEvents: ViewEvent[]; watchProgress: WatchProgressRow[] }>
  >({});

  // ─── B3 State ─────────────────────────────────────────────────────
  type TimelineEventRow = {
    id: string;
    event_type: string;
    event_layer: "fact" | "inference" | "declared" | null;
    event_data: Record<string, unknown> | null;
    created_at: string;
  };

  type DealAssetRow = {
    id: string;
    asset_type: string;
    asset_purpose: string;
    version_number: number | null;
  };

  const [timelineEvents, setTimelineEvents] = useState<TimelineEventRow[]>([]);
  const [dealAssets, setDealAssets] = useState<DealAssetRow[]>([]);
  const [q3DocEvents, setQ3DocEvents] = useState<{ asset_id: string }[]>([]);
  const [q3VideoHasEvents, setQ3VideoHasEvents] = useState<boolean>(false);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [q3Loading, setQ3Loading] = useState(true);

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

        // Fetch deal score + viewers + agent_context
        const [dealScoreRes, viewersRes, agentCtxRes] = await Promise.all([
          supabase.from("deal_scores").select("*").eq("campaign_id", id).order("scored_at", { ascending: false }).limit(1),
          supabase.from("viewers").select("*").eq("campaign_id", id).order("contact_score", { ascending: false, nullsFirst: false }),
          supabase.from("agent_context").select("*").eq("campaign_id", id).maybeSingle(),
        ]);
        if (dealScoreRes.data?.[0]) setDealScore(dealScoreRes.data[0]);
        if (viewersRes.data) setViewers(viewersRes.data);
        if (agentCtxRes.data) setAgentContext(agentCtxRes.data);
        // Initialize snooze date from campaign
        if (campaignData.snoozed_until) setSnoozeDate(new Date(campaignData.snoozed_until));
      } catch {
        console.error("Fetch campaign failed");
        toast.error("Erreur lors du chargement du deal");
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
      toast.success("Deal resoumis pour approbation");
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

  // ─── HOOKS THAT MUST BE BEFORE EARLY RETURNS ──────────────────────
  const LAYER_MAP_REF: Record<string, { label: string; estimated: number }> = {
    executive: { label: "COMEX", estimated: 3 },
    financial: { label: "Finance", estimated: 2 },
    technical: { label: "Technique", estimated: 5 },
  };

  const computedLayers = useMemo(() => {
    return Object.entries(LAYER_MAP_REF).map(([key, cfg]) => {
      const matchingViewers = viewers.filter((v: any) => {
        const role = (v.inferred_role || "").toLowerCase();
        const contactType = (v.contact_type || "").toLowerCase();
        return role.includes(key) || contactType.includes(key);
      });
      const hasConfirmed = matchingViewers.some(
        (v: any) => v.identity_confidence === "high" || v.identity_confidence === "verified"
      );
      return {
        layer: cfg.label,
        current: matchingViewers.length,
        estimated: cfg.estimated,
        confirmed: matchingViewers.length > 0 && hasConfirmed,
      };
    });
  }, [viewers]);

  const ghostLayerContacts = useMemo(() => {
    return computedLayers.filter((l) => l.current > 0 && !l.confirmed);
  }, [computedLayers]);

  const showSignalBanner = useMemo(() => {
    if (!campaign) return false;
    const c = campaign as any;
    if (c.first_action_completed_at) return false;
    if (!c.first_signal_at) return false;
    const d = safeDate(c.first_signal_at);
    if (!d) return false;
    const signalAge = Date.now() - d.getTime();
    return signalAge <= 48 * 60 * 60 * 1000;
  }, [campaign]);

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
          <p className="text-muted-foreground">Deal non trouvé</p>
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
                    {subCampaigns.length} sous-deal{subCampaigns.length > 1 ? "s" : ""}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {(campaign as any).identities?.display_name || "Identité"} • Créé le{" "}
                  {safeFormatDate(campaign.created_at, "d MMMM yyyy", { locale: fr })}
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
                <h2 className="text-lg font-semibold text-foreground">Sous-deals</h2>
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

  // ─── Helper: snooze deal ────────────────────────────────────────────
  const handleSnooze = async (date: Date) => {
    if (!campaign) return;
    try {
      await supabase.from("campaigns").update({
        deal_status: "snoozed",
        snoozed_until: date.toISOString(),
      }).eq("id", campaign.id);
      setCampaign(prev => prev ? { ...prev, deal_status: "snoozed", snoozed_until: date.toISOString() } : null);
      setSnoozeDate(date);
      toast.success(`Deal en veille jusqu'au ${format(date, "d MMMM yyyy", { locale: fr })} — notifications suspendues.`);
    } catch { toast.error("Erreur"); }
  };

  const handleReactivate = async () => {
    if (!campaign) return;
    try {
      await supabase.from("campaigns").update({
        deal_status: "active",
        snoozed_until: null,
      }).eq("id", campaign.id);
      setCampaign(prev => prev ? { ...prev, deal_status: "active", snoozed_until: null } : null);
      setSnoozeDate(undefined);
      toast.success("Deal réactivé");
    } catch { toast.error("Erreur"); }
  };

  // ─── Computed values ──────────────────────────────────────────────
  const dealValue = (campaign.metadata as any)?.deal_value;
  const isSnoozed = (campaign as any).deal_status === "snoozed" && (campaign as any).snoozed_until;
  const lastUpdate = (() => {
    const d = safeDate(campaign.updated_at);
    if (!d) return "—";
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    return `il y a ${Math.floor(hrs / 24)}j`;
  })();

  // Stage label mapping — terrain language
  const STAGE_LABELS: Record<string, string> = {
    qualification: "Phase découverte",
    rfp: "Appel d'offres en cours",
    shortlist: "Phase finale",
    negotiation: "Négociation active",
    close: "Closing imminent",
  };

  // NBA data — must be before desValue
  const safeDealScore = dealScore ?? {};
  const safeAgentContext = agentContext ?? {};
  const daysSinceSignal = safeDealScore.days_since_last_signal ?? undefined;
  const recAction = (safeDealScore.recommended_action_v2 as Record<string, unknown> | null) ?? null;
  const nbaActionLine = (recAction?.action as string) || (safeDealScore.recommended_action as any)?.label || "Définir la prochaine action";
  const stageLabel = STAGE_LABELS[safeAgentContext.stage || ""] || safeAgentContext.stage || "—";

  const desValue = safeDealScore.des ?? null;
  const desClass = desValue == null ? "bg-muted text-muted-foreground"
    : desValue >= 70 ? "bg-accent/15 text-accent"
    : desValue >= 40 ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]"
    : "bg-destructive/15 text-destructive";

  // Mock timeline events
  const mockTimelineEvents = [
    { id: "1", type: "view", label: "Claire Martin a ouvert le deck pricing", detail: "se.com · desktop · 3 min", time: "il y a 2h" },
    { id: "2", type: "share", label: "Claire Martin a partagé le lien", detail: "1 nouveau viewer détecté", time: "il y a 1j" },
    { id: "3", type: "cta_click", label: "Lucas Perrin a cliqué le CTA", detail: "Réserver une démo", time: "il y a 3j" },
    { id: "4", type: "view", label: "Nathalie Roy a ouvert la vidéo exec", detail: "se.com · mobile · 45s", time: "il y a 5j" },
    { id: "5", type: "declared", label: "Call positif enregistré", detail: "Déclaré par l'AE", time: "il y a 7j" },
  ];

  // Contact badge helper
  const getContactBadge = (status: string) => {
    switch (status) {
      case "sponsor_actif": return <Badge className="bg-accent/15 text-accent border-accent/30 text-[10px]">Sponsor actif</Badge>;
      case "à_réactiver": case "neutre": return <Badge className="bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30 text-[10px]">À réactiver</Badge>;
      case "bloqueur_potentiel": return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">À confirmer</Badge>;
      case "peu_engagé": return <Badge className="bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border-[hsl(var(--info))]/30 text-[10px]">Nouveau</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">Inconnu</Badge>;
    }
  };
  const nbaWhyLine = (() => {
    let line = `${(viewers ?? []).length} contact${(viewers ?? []).length !== 1 ? "s" : ""} · ${stageLabel}`;
    if (safeAgentContext.decision_window) {
      const formatted = safeFormatDate(safeAgentContext.decision_window, "d MMMM", { locale: fr });
      if (formatted !== "—") line += ` · décision ${formatted}`;
    }
    return line;
  })();
  // NBA "Je l'ai fait" handler
  const handleNBAMarkDone = async () => {
    if (!campaign) return;
    try {
      await supabase.from("campaigns").update({
        first_action_completed_at: new Date().toISOString(),
      }).eq("id", campaign.id);
      setCampaign(prev => prev ? { ...prev, first_action_completed_at: new Date().toISOString() } as any : null);
      toast.success("Action notée — Ekko surveille la suite");
    } catch { toast.error("Erreur"); }
  };

  // NBA secondary action detection
  const nbaSecondaryAction = (() => {
    const actionStr = ((recAction?.action as string) || "").toLowerCase();
    if (actionStr.includes("contenu") || actionStr.includes("envoyer") || actionStr.includes("asset")) {
      return { label: "Envoyer un contenu", onClick: () => navigate(`/app/campaigns/${id}?tab=assets`) };
    }
    if (actionStr.includes("contact") || actionStr.includes("ajouter")) {
      return { label: "Ajouter un contact", onClick: () => navigate(`/app/campaigns/${id}?tab=intelligence`) };
    }
    return undefined;
  })();

  // Show NBA only if first_action_completed_at is null
  const showNBA = !(campaign as any)?.first_action_completed_at;

  // ─── SUB-CAMPAIGN / STANDALONE CAMPAIGN DETAIL ─────────────────────
  return (
    <AppLayout>
      {/* Signal banner removed — replaced by inline badge in deal list */}

      {/* Snoozed banner */}
      {isSnoozed && (
        <div className="mb-4 p-3 rounded-lg bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PauseCircle className="h-4 w-4 text-[hsl(var(--warning))]" />
            <span className="text-sm">
              Deal en veille jusqu'au{" "}
              <span className="font-medium">{safeFormatDate((campaign as any).snoozed_until, "d MMMM yyyy", { locale: fr })}</span>
            </span>
          </div>
          <button className="link-action text-sm" onClick={handleReactivate}>Réactiver</button>
        </div>
      )}

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
              <h1 className="text-2xl font-bold text-[#0D1B2A]">{campaign.name}</h1>
              {dealValue && <span className="text-lg font-semibold text-muted-foreground">{(dealValue / 1000).toFixed(0)}k€</span>}
              {agentContext?.stage && (
                <Badge variant="outline" className="text-xs text-muted-foreground border-border bg-muted/40">{stageLabel}</Badge>
              )}
              {(() => {
                const rl = (campaign as any).deal_risk_level || dealScore?.risk_level || "healthy";
                const riskCfg: Record<string, { label: string; cls: string }> = {
                  high_risk: { label: "Risque élevé", cls: "bg-[#FCEBEB] text-[#E24B4A] border-[#E24B4A]/30" },
                  critical: { label: "Risque élevé", cls: "bg-[#FCEBEB] text-[#E24B4A] border-[#E24B4A]/30" },
                  watch: { label: "À surveiller", cls: "bg-[#FAEEDA] text-[#E8A838] border-[#E8A838]/30" },
                  healthy: { label: "Sain", cls: "bg-[#D0FAE8] text-[#1AE08A] border-[#1AE08A]/30" },
                };
                const cfg = riskCfg[rl] || riskCfg.healthy;
                return (
                  <Badge variant="outline" className={cn("text-xs font-semibold border", cfg.cls)}>
                    {cfg.label}
                  </Badge>
                );
              })()}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("px-3 py-1.5 rounded-full text-sm font-bold shadow-sm cursor-default", desClass)}>
                      {desValue == null ? "DES —" : desValue < 40 ? "DES faible" : desValue <= 70 ? "DES moyen" : "DES fort"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs text-muted-foreground">Score : {desValue ?? "—"}/100</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <button
              onClick={() => navigate(`/app/campaigns/${id}/quick`)}
              className="text-xs text-[#0D1B2A] underline hover:text-foreground mt-1 inline-flex items-center gap-1"
            >
              → Vue rapide
            </button>
            <p className="mt-1 text-sm text-muted-foreground">
              Dernière activité : {lastUpdate}
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              Analyse mise à jour {lastUpdate}
            </p>
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  Mettre en veille
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={snoozeDate}
                  onSelect={(d) => d && handleSnooze(d)}
                  disabled={(d) => d < new Date()}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={() => setShowAgent(!showAgent)}>
              <MessageSquare className="mr-2 h-3.5 w-3.5" />
              Agent Ekko
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDealClose(true)}>
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
              Clôturer
            </Button>
          </div>
        </div>
      </div>

      {/* Video generation alert */}
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
                {hasActiveJobs ? "Génération vidéo en cours..." : jobsFailed > 0 ? "Génération terminée avec des erreurs" : "Génération terminée"}
              </AlertTitle>
              <AlertDescription className="mt-1">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {jobsCompleted}/{jobsTotal} vidéo{jobsTotal > 1 ? "s" : ""} terminée{jobsCompleted > 1 ? "s" : ""}
                    {jobsFailed > 0 && <span className="text-destructive ml-1">· {jobsFailed} erreur{jobsFailed > 1 ? "s" : ""}</span>}
                  </span>
                  {isVideoPolling && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Actualisation auto
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
                size="sm" variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => { setEditedScript(campaign.script); setIsEditingScript(true); }}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" /> Modifier le script
              </Button>
            ) : (
              <div className="space-y-3">
                <Textarea value={editedScript} onChange={(e) => setEditedScript(e.target.value)} className="min-h-[120px] bg-background" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveScript} disabled={isSavingScript}>
                    <Save className="mr-2 h-3.5 w-3.5" /> {isSavingScript ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingScript(false)}>Annuler</Button>
                </div>
              </div>
            )}
            {scriptSaved && !isEditingScript && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> Script modifié
                </div>
                <Button size="sm" onClick={handleResubmit} disabled={isResubmitting} className="bg-primary hover:bg-primary/90">
                  <Send className="mr-2 h-3.5 w-3.5" /> {isResubmitting ? "Resoumission..." : "Resoumettre pour approbation"}
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* ═══ TABS ═══ */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Résumé du deal</TabsTrigger>
          <TabsTrigger value="intelligence">Deal Intelligence</TabsTrigger>
          <TabsTrigger value="assets">Contenus envoyés</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Résumé du deal ─── */}
        <TabsContent value="overview" className="space-y-3">
          {/* NBA Card — visible only if no action completed yet */}
          {showNBA && (
            <SectionGuard name="NBACard">
              <NBACard
                actionLine={nbaActionLine}
                whyLine={nbaWhyLine}
                confidenceLabel="Confiance modérée"
                riskLevel={(campaign as any).deal_risk_level || dealScore?.risk_level || "healthy"}
                onMarkDone={handleNBAMarkDone}
                secondaryAction={nbaSecondaryAction}
              />
            </SectionGuard>
          )}

          {/* Pourquoi — Insights compressés inline */}
          <SectionGuard name="Insights">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pourquoi</p>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-[hsl(var(--info))]/10 text-[hsl(var(--info))] border-[hsl(var(--info))]/30">FAIT</Badge>
                  <p className="text-sm text-foreground leading-snug">{viewers.length === 0 ? "Aucun relais interne identifié — vigilance requise" : `${viewers.length} contact${viewers.length !== 1 ? "s" : ""} identifié${viewers.length !== 1 ? "s" : ""}`}{daysSinceSignal !== undefined && daysSinceSignal > 7 ? ` · Deal qui refroidit — aucune activité depuis ${daysSinceSignal}j` : daysSinceSignal !== undefined && daysSinceSignal > 0 ? ` · aucune activité depuis ${daysSinceSignal}j` : ""} · {stageLabel}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30">INFÉRENCE ≈</Badge>
                  <p className="text-sm text-foreground leading-snug">{`Profil acheteur : remplacement ${safeAgentContext.incumbent_type === "competitor_named" ? "concurrent identifié" : safeAgentContext.incumbent_type === "internal_tool" ? "outil interne" : "incumbent inconnu"} · ${safeAgentContext.competitive_situation || "—"}`}</p>
                </div>
              </div>
            </div>
          </SectionGuard>

          {/* Dernier signal — always visible, one discreet line */}
          <SectionGuard name="DernierSignal">
            {mockTimelineEvents.length > 0 ? (
              <p className="text-xs text-muted-foreground px-1">
                Dernier signal : {mockTimelineEvents[0].label} · {mockTimelineEvents[0].time}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground px-1">Aucun signal reçu pour le moment.</p>
            )}
          </SectionGuard>

          {/* Timeline — collapsed by default, with chevron and preview */}
          <SectionGuard name="Timeline">
            <Card className="shadow-none">
              <CardHeader className="pb-2 pt-3 px-3">
                <button
                  className="flex items-center justify-between w-full text-left cursor-pointer rounded-md px-1 py-1 hover:bg-muted/40 transition-colors"
                  onClick={() => setTimelineOpen((v) => !v)}
                >
                  <CardTitle className="text-sm font-semibold">Derniers événements</CardTitle>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", timelineOpen && "rotate-180")} />
                </button>
              </CardHeader>
              {/* Preview line when collapsed */}
              {!timelineOpen && mockTimelineEvents.length > 0 && (
                <CardContent className="pt-0 px-4 pb-3">
                  <p className="text-xs text-muted-foreground truncate">
                    {mockTimelineEvents[0].label} · {mockTimelineEvents[0].time}
                  </p>
                </CardContent>
              )}
              {mockTimelineEvents.length > 0 ? (
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-out",
                    timelineOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <CardContent className="pt-0 px-3">
                    <DealTimeline events={mockTimelineEvents} />
                  </CardContent>
                </div>
              ) : (
                <CardContent className="pt-0 px-3">
                  <p className="text-xs text-muted-foreground py-4 text-center">Aucun événement enregistré.</p>
                </CardContent>
              )}
            </Card>
          </SectionGuard>

          {/* Signal offline — collapsible with chevron and preview */}
          <SectionGuard name="SignalOffline">
            <Card className="shadow-none">
              <CardHeader className="pb-2 pt-3 px-3">
                <button
                  className="flex items-center justify-between w-full text-left cursor-pointer rounded-md px-1 py-1 hover:bg-muted/40 transition-colors"
                  onClick={(e) => {
                    const content = e.currentTarget.closest('.shadow-none')?.querySelector('[data-offline-content]');
                    const chevron = e.currentTarget.querySelector('[data-offline-chevron]');
                    if (content) content.classList.toggle("hidden");
                    if (chevron) chevron.classList.toggle("rotate-180");
                  }}
                >
                  <CardTitle className="text-sm font-semibold">Signal offline</CardTitle>
                  <ChevronDown data-offline-chevron className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                </button>
              </CardHeader>
              {/* Preview line */}
              <CardContent className="pt-0 px-4 pb-1">
                <p className="text-xs text-muted-foreground">
                  {daysSinceSignal !== undefined && daysSinceSignal > 5
                    ? `Aucune activité depuis ${daysSinceSignal}j — que s'est-il passé ?`
                    : "Aucun signal offline"}
                </p>
              </CardContent>
              <div data-offline-content className="hidden">
                <CardContent className="pt-0 px-3">
                  <WhatHappenedWidget campaignId={campaign.id} />
                </CardContent>
              </div>
            </Card>
          </SectionGuard>
        </TabsContent>

        {/* ─── Tab 2: Deal Intelligence ─── */}
        <TabsContent value="intelligence" className="space-y-6">
          <SectionGuard name="PowerMap">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" /> Power Map
                </CardTitle>
                <CardDescription>
                  {viewers.length === 0
                    ? "Ajoutez des contacts pour visualiser le comité d'achat"
                    : viewers.length < 3
                      ? `${viewers.length} contact${viewers.length > 1 ? "s" : ""} / ~${safeAgentContext.committee_size_declared || 8} estimés`
                      : "Cartographie du buying committee"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {viewers.length === 0 ? (
                  <div className="py-8">
                    <div className="flex justify-center gap-8 mb-6">
                      {["Direction", "Finance", "Metier"].map((role) => (
                        <div key={role} className="flex flex-col items-center gap-2">
                          <div className="w-14 h-14 rounded-full bg-[#D5D2CB]/40 border-2 border-[#D5D2CB] flex items-center justify-center">
                            <Users className="h-5 w-5 text-[#D5D2CB]" />
                          </div>
                          <span className="text-xs text-[#D5D2CB] font-medium">{role}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-4 mb-6">
                      <div className="w-px h-6 bg-[#D5D2CB]/30" />
                      <div className="w-20 h-px bg-[#D5D2CB]/30 self-center" />
                      <div className="w-px h-6 bg-[#D5D2CB]/30" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground mb-1">Aucun écho identifié sur ce deal.</p>
                      <p className="text-xs text-muted-foreground mb-4">Envoyez un contenu pour générer les premiers signaux.</p>
                      <Button size="sm" className="rounded-cta bg-accent text-accent-foreground hover:bg-accent/90">
                        <Plus className="mr-2 h-3.5 w-3.5" /> Ajouter un contact
                      </Button>
                      <div className="mt-6 text-left max-w-xs mx-auto">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Contacts suggérés à identifier :</p>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Un décideur Finance (CFO, DAF)</li>
                          <li>Un sponsor métier</li>
                          <li>Un contact technique si le deal le nécessite</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <PowerMap campaignId={campaign.id} orgId={membership?.org_id || ""} />
                )}
              </CardContent>
            </Card>
          </SectionGuard>

          {/* Layer Coverage */}
          <SectionGuard name="LayerCoverage">
            {computedLayers.length > 0 ? (
              <div>
                <p className="text-sm font-semibold mb-2">Couverture du comité</p>
                <LayerCoverage layers={computedLayers} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Couverture du comité : aucune donnée.</p>
            )}
          </SectionGuard>

          {/* Ghost cards for inferred contacts not yet visible in Power Map */}
          <SectionGuard name="GhostContacts">
            {ghostLayerContacts.length > 0 && (
              <div className="space-y-1.5">
                {ghostLayerContacts.map((l) => (
                  <div key={l.layer} className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border bg-muted/20">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      ~{l.current} contact{l.current > 1 ? "s" : ""} {l.layer} identifié{l.current > 1 ? "s" : ""} (estimation)
                    </span>
                    <Badge variant="outline" className="text-[9px] ml-auto">confiance faible</Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionGuard>

          {/* Contact list */}
          <SectionGuard name="ContactList">
            {viewers.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Contacts identifiés</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {viewers.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{(v.name || "?")[0].toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{v.name || "Inconnu"}</p>
                          <p className="text-xs text-muted-foreground">{v.title || ""} {v.company ? `· ${v.company}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getContactBadge(v.status || "inconnu")}
                        <span className="text-xs text-muted-foreground font-mono">{v.contact_score ?? "—"}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </SectionGuard>

          {/* No data state */}
          {!dealScore && viewers.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Aucune donnée disponible</p>
                <p className="text-sm text-muted-foreground mt-1">Partagez la landing page pour commencer à collecter des signaux</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Tab 3: Assets ─── */}
        <TabsContent value="assets" className="space-y-6">
          <SectionGuard name="AssetsTab">
            {/* Video generation jobs */}
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
                            <p className="text-sm font-medium truncate">Destinataire #{job.recipient_id?.slice(0, 8) || "—"}</p>
                            <p className={cn("text-xs", cfg.color)}>{cfg.label}</p>
                          </div>
                          {job.error_message && (
                            <p className="text-xs text-destructive max-w-[200px] truncate" title={job.error_message}>{job.error_message}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Video asset */}
            <Card>
              <CardHeader>
                <CardTitle>Contenus envoyés</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const url = getVideoUrl(videos.find((v) => v.campaign_id === id));
                    if (!url && videos.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                          <Video className="h-12 w-12 text-muted-foreground/40" />
                          <p className="font-medium text-foreground">
                            {campaign.status === 'generating' ? 'Génération en cours...' :
                             campaign.status === 'pending_approval' ? "En attente d'approbation" :
                             'Aucun écho pour le moment.'}
                          </p>
                          <p className="text-xs text-muted-foreground">Tout contenu partagé devient un capteur.</p>
                          {campaign.status !== 'generating' && campaign.status !== 'pending_approval' && (
                            <>
                              <div className="flex flex-wrap justify-center gap-2">
                                <Button size="sm" className="rounded-cta bg-accent text-accent-foreground hover:bg-accent/90">
                                  <Video className="mr-2 h-3.5 w-3.5" /> Envoyer une vidéo
                                </Button>
                                <Button size="sm" variant="outline" className="rounded-cta">
                                  <FileText className="mr-2 h-3.5 w-3.5" /> Partager un document
                                </Button>
                                <Button size="sm" variant="outline" className="rounded-cta">
                                  <Download className="mr-2 h-3.5 w-3.5" /> Importer un fichier
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground/70 mt-2 max-w-xs">
                                Chaque contenu envoyé permet de détecter qui s'engage et comment.
                              </p>
                            </>
                          )}
                        </div>
                      );
                  }
                  return (
                    <div className="space-y-3">
                      {url && (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <Video className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Vidéo personnalisée</p>
                              <p className="text-xs text-muted-foreground">Vidéo · Ouvert</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => copyShareLink(shareLink)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </SectionGuard>

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
