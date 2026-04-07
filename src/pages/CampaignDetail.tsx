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
  Link,
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
  const [committeeLayers, setCommitteeLayers] = useState<any[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [agentContext, setAgentContext] = useState<any>(null);
  const [snoozeDate, setSnoozeDate] = useState<Date | undefined>();
  const [offlineSignalSent, setOfflineSignalSent] = useState(false);
  const [freeSignalText, setFreeSignalText] = useState("");
  const [freeSignalLoading, setFreeSignalLoading] = useState(false);
   const [freeSignalStatus, setFreeSignalStatus] = useState<"idle" | "success" | "error">("idle");
  const [detectedContacts, setDetectedContacts] = useState<string[]>([]);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  // E3 — Guardrails + execution token
  const [guardrailBlocked, setGuardrailBlocked] = useState<string | null>(null);
  const [reminderShown, setReminderShown] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [actionConfirmed, setActionConfirmed] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  // E2 — Contextual toast for silent deals
  const [showContextualToast, setShowContextualToast] = useState(false);
  const [contextualDealName, setContextualDealName] = useState<string | null>(null);
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

  // C3 — Explainability: local states for alert feedback
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [pendingDismiss, setPendingDismiss] = useState<Set<string>>(new Set());
  const [confirmedAlerts, setConfirmedAlerts] = useState<Set<string>>(new Set());
  const [feedbackMessages, setFeedbackMessages] = useState<Record<string, "confirmed" | "rejected">>({});
  const [processingAlerts, setProcessingAlerts] = useState<Set<string>>(new Set());
  const dismissTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(dismissTimersRef.current).forEach(clearTimeout);
    };
  }, []);

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

        // Fetch deal score + viewers + agent_context + timeline + deal_assets + committee_layers
        const [dealScoreRes, viewersRes, agentCtxRes, timelineRes, dealAssetsRes, committeeLayersRes] = await Promise.all([
          supabase.from("deal_scores").select("*").eq("campaign_id", id).order("scored_at", { ascending: false }).limit(1),
          supabase.from("viewers").select("*").eq("campaign_id", id).order("contact_score", { ascending: false, nullsFirst: false }),
          supabase.from("agent_context").select("*").eq("campaign_id", id).maybeSingle(),
          supabase.from("timeline_events").select("id, event_type, event_layer, event_data, created_at").eq("campaign_id", id).order("created_at", { ascending: false }).limit(5),
          supabase.from("deal_assets").select("id, asset_type, asset_purpose, version_number").eq("campaign_id", id).eq("asset_status", "active"),
          supabase.from("committee_layers").select("layer, expected_weight, typical_titles"),
        ]);
        if (dealScoreRes.data?.[0]) setDealScore(dealScoreRes.data[0]);
        if (viewersRes.data) setViewers(viewersRes.data);
        if (agentCtxRes.data) setAgentContext(agentCtxRes.data);
        if (committeeLayersRes.error) console.error("[C1b][committee_layers][campaign_id=%s] %s", id, committeeLayersRes.error.message);
        else setCommitteeLayers(committeeLayersRes.data || []);

        // B3 — timeline_events
        if (timelineRes.error) console.error("[B3][timeline_events][campaign_id=%s] %s", id, timelineRes.error.message);
        else setTimelineEvents((timelineRes.data || []) as TimelineEventRow[]);
        setTimelineLoading(false);

        // B3 — deal_assets
        if (dealAssetsRes.error) console.error("[B3][deal_assets][campaign_id=%s] %s", id, dealAssetsRes.error.message);
        else setDealAssets((dealAssetsRes.data || []) as DealAssetRow[]);

        // B3 — Q3 queries
        const criticalPurposes = ["pricing", "closing", "technical"];
        const dealAssetsData = (dealAssetsRes.data || []) as DealAssetRow[];

        const documentAssetIds: string[] = [...new Set(
          dealAssetsData
            .filter((a: DealAssetRow) => a.asset_type === "document" && criticalPurposes.includes(a.asset_purpose))
            .map((a: DealAssetRow) => a.id)
        )];
        const videoPurposes: string[] = [...new Set(
          dealAssetsData
            .filter((a: DealAssetRow) => a.asset_type === "video" && criticalPurposes.includes(a.asset_purpose))
            .map((a: DealAssetRow) => a.asset_purpose)
        )];

        if (documentAssetIds.length === 0 && videoPurposes.length === 0) {
          setQ3Loading(false);
        } else {
          const emptyDocResult = { data: [] as { asset_id: string }[], error: null } as const;
          const emptyVidResult = { data: [] as { campaign_id: string }[], error: null } as const;

          const [docEventsRes, videoEventsRes] = await Promise.all([
            documentAssetIds.length > 0
              ? supabase.from("asset_page_events").select("asset_id").in("asset_id", documentAssetIds).gt("time_spent_seconds", 5)
              : Promise.resolve(emptyDocResult),
            videoPurposes.length > 0
              ? supabase.from("video_events").select("campaign_id").eq("campaign_id", id).limit(1)
              : Promise.resolve(emptyVidResult),
          ]);

          if (docEventsRes.error) console.error("[B3][asset_page_events][campaign_id=%s] %s", id, docEventsRes.error.message);
          else setQ3DocEvents((docEventsRes.data || []) as { asset_id: string }[]);

          if (videoEventsRes.error) console.error("[B3][video_events][campaign_id=%s] %s", id, videoEventsRes.error.message);
          else setQ3VideoHasEvents((videoEventsRes.data || []).length > 0);

          setQ3Loading(false);
        }

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

  // ── E2 — Contextual toast for silent deals ─────────────────────────
  useEffect(() => {
    const sessionKey = "ekko_contextual_toast_shown";
    if (sessionStorage.getItem(sessionKey)) return;
    if (!membership?.org_id || !id) return;

    const checkSilentDeals = async () => {
      const { data: orgCampaigns } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("org_id", membership.org_id)
        .neq("id", id)
        .limit(20);
      const otherIds = (orgCampaigns || []).map((c: any) => c.id);
      if (otherIds.length === 0) return;

      const { data: silentScore } = await supabase
        .from("deal_scores")
        .select("campaign_id, days_since_last_signal")
        .in("campaign_id", otherIds)
        .gt("days_since_last_signal", 7)
        .order("days_since_last_signal", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (silentScore) {
        const found = orgCampaigns?.find((c: any) => c.id === silentScore.campaign_id);
        setContextualDealName(found?.name || "un deal");
        setShowContextualToast(true);
        sessionStorage.setItem(sessionKey, "1");
      }
    };
    checkSilentDeals();
  }, [membership?.org_id, id]);

  // ── E3 — Reminder toast + token expiry check ────────────────────────
  useEffect(() => {
    if (!id || reminderShown) return;

    const checkReminder = async () => {
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: pendingAct } = await supabase
        .from("execution_actions")
        .select("id, created_at, reminder_sent")
        .eq("campaign_id", id)
        .is("acted_on_at", null)
        .is("reminder_sent", null)
        .lte("created_at", since48h)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingAct) {
        const { data: scoreData } = await supabase
          .from("deal_scores")
          .select("priority_score")
          .eq("campaign_id", id)
          .order("scored_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (scoreData && (scoreData as any).priority_score > 80) {
          setReminderShown(true);
          toast("Vous n'avez pas encore agi sur ce signal. Voulez-vous réévaluer ?", {
            duration: 10000,
            action: {
              label: "Agir maintenant",
              onClick: () => {
                document.querySelector('[data-nba-card]')?.scrollIntoView({ behavior: "smooth" });
              },
            },
          });
          await supabase.from("execution_actions")
            .update({ reminder_sent: new Date().toISOString() })
            .eq("id", pendingAct.id);
        }
      }
    };

    const checkTokenExpiry = async () => {
      const { data: expiredToken } = await supabase
        .from("execution_actions")
        .select("id, token_expires_at")
        .eq("campaign_id", id)
        .is("acted_on_at", null)
        .not("token_expires_at", "is", null)
        .lt("token_expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      if (expiredToken) setTokenExpired(true);
    };

    checkReminder();
    checkTokenExpiry();
  }, [id, reminderShown]);

  // Fetch pending execution action for guardrails
  useEffect(() => {
    if (!id) return;
    const fetchPending = async () => {
      const { data } = await supabase
        .from("execution_actions")
        .select("id, execution_token, token_expires_at, contact_email, asset_id, guardrail_status, acted_on_at")
        .eq("campaign_id", id)
        .eq("guardrail_status", "pending")
        .is("acted_on_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setPendingAction(data);
    };
    fetchPending();
  }, [id]);

  const kpis = useMemo(() => computeKpis(viewEvents, watchProgress), [viewEvents, watchProgress]);

  // ─── B3 — getSignalFreshness ──────────────────────────────────────
  function getSignalFreshness(isoDate: string): "recent" | "old" | null {
    const diffHours = (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60);
    if (diffHours < 72) return "recent";
    if (diffHours > 168) return "old";
    return null;
  }

  // ─── B3 — MAPPING_TABLE ───────────────────────────────────────────
  const MAPPING_TABLE: Record<string, string> = {
    "video_opened": "Vidéo ouverte",
    "video_started": "Vidéo démarrée",
    "watch_progress": "Progression vidéo",
    "video_completed": "Vidéo regardée en entier",
    "segment_replayed": "Segment rejoué",
    "cta_clicked": "CTA cliqué",
    "page_shared": "Contenu partagé",
    "doc_opened": "Document ouvert",
    "doc_page_viewed": "Page consultée",
    "doc_downloaded": "Document téléchargé",
    "doc_return_visit": "Retour sur le document",
    "ae_action_done": "Action effectuée par l'AE",
    "offline_signal": "Signal offline enregistré",
  };

  const displayEvents = useMemo(() => {
    return timelineEvents.map(row => ({
      id: row.id,
      type: row.event_type,
      label: (typeof row.event_data?.summary_fr === "string" && (row.event_data.summary_fr as string).trim())
        ? (row.event_data.summary_fr as string).trim()
        : (MAPPING_TABLE[row.event_type] ?? row.event_type),
      time: (() => {
        const d = safeDate(row.created_at);
        if (!d) return "—";
        try { return formatDistanceToNow(d, { locale: fr, addSuffix: true }); } catch { return "—"; }
      })(),
      event_layer: row.event_layer ?? undefined,
      freshness: getSignalFreshness(row.created_at),
    }));
  }, [timelineEvents]);

  // ─── B3 — Q1: Qui regarde ? ──────────────────────────────────────
  const q1Text = useMemo(() => {
    if (viewers.length === 0) return "Aucun contact identifié — partagez un asset pour générer les premiers signaux.";
    return viewers
      .map((v: any) => v.name ? (v.title ? `${v.name} (${v.title})` : v.name) : "Contact identifié partiellement")
      .join(" · ");
  }, [viewers]);

  // ─── B3 — Q2: Qui ne regarde pas ? ───────────────────────────────
  // TEMPORAIRE B3 UNIQUEMENT — matching par mots-clés dans le frontend.
  // Cette logique sera remplacée par le layer scoring backend (committee_layers) en C1b.
  // NE PAS réutiliser cette logique ailleurs. NE PAS la considérer comme source moteur.
  const LAYER_KEYWORDS: Record<string, string[]> = {
    executive: ["CEO","CFO","COO","DG","PDG","Directeur Général","Directeur Financier"],
    financial: ["DAF","Contrôleur","Finance","Trésorier"],
    legal: ["Juridique","DPO","Legal","Juriste"],
    procurement: ["Achats","Procurement","Acheteur"],
    technical: ["DSI","CTO","Architecte","Responsable SI","IT"],
    operational: ["Chef projet","Manager","Responsable","Directeur de projet"],
  };

  const q2Text = useMemo(() => {
    if (viewers.length === 0) return "Impossible à déterminer — aucun contact identifié.";
    const viewerTitles = viewers.map((v: any) => ((v.title as string) ?? "").toLowerCase());
    const missingCritical: string[] = [];
    const missingOther: string[] = [];
    Object.entries(LAYER_KEYWORDS).forEach(([layer, keywords]) => {
      const covered = keywords.some(kw => viewerTitles.some(t => t.includes(kw.toLowerCase())));
      if (!covered) {
        if (["executive", "financial"].includes(layer)) missingCritical.push(layer);
        else missingOther.push(layer);
      }
    });
    if (missingCritical.length === 0 && missingOther.length === 0) return "Couverture complète identifiée.";
    const parts = [
      ...missingCritical.map(l => `${l} : non couvert`),
      ...missingOther.map(l => `${l} : non couvert`),
    ];
    return parts.join(" · ");
  }, [viewers]);

  // ─── B3 — Q3: Qui a lu ce qui compte ? ───────────────────────────
  const q3Result = useMemo(() => {
    const critPurposes = ["pricing", "closing", "technical"];
    const openedDocAssetIds = new Set(q3DocEvents.map(e => e.asset_id));

    const docLines = dealAssets
      .filter(a => a.asset_type === "document" && critPurposes.includes(a.asset_purpose))
      .map(a => `${a.asset_purpose} (document) : ${openedDocAssetIds.has(a.id) ? "ouvert" : "non ouvert"}`);

    const videoLines = [...new Set(
      dealAssets
        .filter(a => a.asset_type === "video" && critPurposes.includes(a.asset_purpose))
        .map(a => a.asset_purpose)
    )].map(purpose => `${purpose} (vidéo) : granularité asset indisponible`);

    const hasVideoAssets = videoLines.length > 0;
    const videoActivity = hasVideoAssets
      ? (q3VideoHasEvents ? "Activité vidéo détectée sur ce deal." : "Aucune activité vidéo détectée sur ce deal.")
      : null;

    if (docLines.length === 0 && videoLines.length === 0)
      return { lines: [] as string[], videoActivity: null as string | null, hasVideoAssets: false };

    return { lines: [...docLines, ...videoLines], videoActivity, hasVideoAssets };
  }, [dealAssets, q3DocEvents, q3VideoHasEvents]);

  // ─── B3 — Q4: Qui vient d'apparaître ? ───────────────────────────
  const q4Text = useMemo(() => {
    const now48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recent = viewers.filter((v: any) => v.first_seen_at && new Date(v.first_seen_at) >= now48h);
    if (recent.length === 0) return "Aucun nouveau contact dans les 48h.";
    return recent
      .map((v: any) => {
        const d = safeDate(v.first_seen_at);
        const ago = d ? (() => { try { return formatDistanceToNow(d, { locale: fr, addSuffix: true }); } catch { return "—"; } })() : "—";
        return `${v.name ?? "Contact"} — détecté ${ago}`;
      })
      .join(", ");
  }, [viewers]);

  // ─── B3 — signalFreshness for NBACard ─────────────────────────────
  const signalFreshness = useMemo(() =>
    dealScore?.last_signal_at
      ? getSignalFreshness(dealScore.last_signal_at)
      : (campaign as any)?.first_signal_at
        ? getSignalFreshness((campaign as any).first_signal_at)
        : null,
  [dealScore, campaign]);

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
  const handleFreeSignal = async () => {
    if (!id || !freeSignalText.trim()) return;
    setFreeSignalLoading(true);
    setFreeSignalStatus("idle");
    try {
      const { data, error } = await supabase.functions.invoke("translate-offline-signal", {
        body: { campaign_id: id, raw_input: freeSignalText.trim() },
      });
      if (error) throw error;
      setFreeSignalText("");
      setFreeSignalStatus("success");

      const contacts: string[] = Array.isArray(data?.extracted?.contacts_detected)
        ? (data.extracted.contacts_detected as string[]).filter(
            (c: string) => typeof c === "string" && c.trim().length > 0
          )
        : [];
      setDetectedContacts(contacts);
      setTimeout(() => setDetectedContacts([]), 20000);
    } catch (err) {
      console.error("[free_signal]", err);
      setFreeSignalStatus("error");
    } finally {
      setFreeSignalLoading(false);
      setTimeout(() => setFreeSignalStatus("idle"), 3000);
    }
  };

  const handleOfflineSignal = async (key: string, label: string) => {
    if (!id) return;
    try {
      const { error: invokeError } = await supabase.functions.invoke(
        "log-offline-signal",
        {
          body: {
            campaign_id: id,
            event_type: "offline_signal",
            event_layer: "declared",
            event_data: { signal: key, label },
          },
        }
      );
      if (invokeError) throw invokeError;

      setOfflineSignalSent(true);
      setTimeout(() => setOfflineSignalSent(false), 3000);

      // Refresh timeline immédiat pour que l'event apparaisse sans recharge page
      const { data: freshTimeline } = await supabase
        .from("timeline_events")
        .select("id, event_type, event_layer, event_data, created_at")
        .eq("campaign_id", id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (freshTimeline) setTimelineEvents(freshTimeline as TimelineEventRow[]);
    } catch (err) {
      console.error("[offline_signal]", err);
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

  // ─── Layer detection utility (C1b) ─────────────────────────────────
  function detectLayer(title: string | null, layers: any[]): string | null {
    if (!title || !layers?.length) return null;
    for (const l of layers) {
      const keywords: string[] = l.typical_titles || [];
      for (const kw of keywords) {
        if (title.toLowerCase().includes(kw.toLowerCase())) return l.layer;
      }
    }
    return null;
  }

  const LAYER_LABELS: Record<string, string> = {
    executive: "Direction", financial: "Finance", legal: "Juridique",
    procurement: "Achats", technical: "Technique", operational: "Opérationnel",
  };
  const LAYER_ESTIMATED: Record<string, number> = {
    executive: 3, financial: 2, legal: 1, procurement: 2, technical: 5, operational: 3,
  };
  const LAYER_ORDER = ["executive", "financial", "legal", "procurement", "technical", "operational"];

  const computedLayers = useMemo(() => {
    if (committeeLayers.length === 0) return [];
    return LAYER_ORDER.map((layerKey) => {
      const matching = viewers.filter((v: any) =>
        detectLayer(v.title, committeeLayers) === layerKey
      );
      const hasConfirmed = matching.some(
        (v: any) => v.identity_confidence === "high" || v.identity_confidence === "verified"
      );
      return {
        layer: LAYER_LABELS[layerKey],
        current: matching.length,
        estimated: LAYER_ESTIMATED[layerKey],
        confirmed: matching.length > 0 && hasConfirmed,
      };
    });
  }, [viewers, committeeLayers]);

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

  // BUG 3 fix — "Dernière activité" shows only prospect events
  const AE_EVENT_TYPES_SET = useMemo(() => new Set([
    "video_generation_started", "video_generation_completed", "deal_created",
    "campaign_created", "script_generated", "approval_sent",
  ]), []);
  const lastProspectEvent = useMemo(() => {
    const prospectEvents = timelineEvents.filter(
      (e) => e.event_layer === "fact" && !AE_EVENT_TYPES_SET.has(e.event_type)
    );
    return prospectEvents.length > 0 ? prospectEvents[0] : null;
  }, [timelineEvents, AE_EVENT_TYPES_SET]);

  // BUG 4 fix — Deal master state
  const dealMasterState = useMemo(() => {
    if (!campaign) return "draft";
    if ((campaign as any).first_signal_at) return "sent";
    const hasActiveAsset = dealAssets.length > 0;
    const hasActiveJobs_ = hasActiveJobs || campaign.status === "generating" || campaign.status === "pending_approval";
    if (hasActiveAsset && !hasActiveJobs_) return "ready";
    if (hasActiveJobs_) return "preparing";
    return "draft";
  }, [campaign, dealAssets, hasActiveJobs]);

  // BUG 1 fix — check if any asset is active/ready for prospect link
  const hasReadyAsset = useMemo(() => dealAssets.length > 0 || videos.some(v => v.is_active), [dealAssets, videos]);

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
    if (!lastProspectEvent) return null;
    const d = safeDate(lastProspectEvent.created_at);
    if (!d) return null;
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    return `il y a ${Math.floor(hrs / 24)}j`;
  })();

  const DEAL_STATE_CONFIG: Record<string, { label: string; emoji: string; cls: string }> = {
    draft: { label: "Vidéo en cours", emoji: "⚪", cls: "bg-muted text-muted-foreground border-border" },
    preparing: { label: "En préparation", emoji: "🟡", cls: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30" },
    ready: { label: "Prêt à envoyer", emoji: "🟢", cls: "bg-accent/15 text-accent border-accent/30" },
    sent: { label: "Envoyé au prospect", emoji: "🔵", cls: "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border-[hsl(var(--info))]/30" },
  };

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

  // B3 — mockTimelineEvents removed, using displayEvents from real data

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
  // NBA "Je l'ai fait" handler — E3 guardrails
  const checkGuardrails = async (contactEmail?: string | null): Promise<{
    passed: boolean;
    reason: string | null;
    guardrail: string | null;
  }> => {
    if (!id) return { passed: true, reason: null, guardrail: null };

    // G3 — deal_not_closed (priorité 1)
    if ((campaign as any)?.deal_status === "closed" || (campaign as any)?.deal_status === "snoozed") {
      return { passed: false, reason: "Ce deal est fermé ou en veille. Rouvrir le deal pour agir.", guardrail: "deal_not_closed" };
    }

    if (contactEmail) {
      // G1 — no_recent_contact
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentContact } = await supabase
        .from("execution_actions")
        .select("id")
        .eq("campaign_id", id)
        .eq("contact_email", contactEmail)
        .gte("acted_on_at", since24h)
        .limit(1)
        .maybeSingle();
      if (recentContact) {
        return { passed: false, reason: "Vous avez déjà contacté ce contact il y a moins de 24h.", guardrail: "no_recent_contact" };
      }

      // G2 — no_upcoming_meeting
      const { data: agentCtxG2 } = await supabase
        .from("agent_context")
        .select("next_meeting_at")
        .eq("campaign_id", id)
        .maybeSingle();
      if (agentCtxG2?.next_meeting_at) {
        const meetingAt = new Date(agentCtxG2.next_meeting_at).getTime();
        const in48h = Date.now() + 48 * 60 * 60 * 1000;
        if (meetingAt < in48h && meetingAt > Date.now()) {
          return { passed: false, reason: "Un appel est prévu avec ce contact dans les 48h.", guardrail: "no_upcoming_meeting" };
        }
      }

      // G5 — asset_not_already_sent
      const currentAssetId = pendingAction?.asset_id ?? (dealScore?.recommended_action_v2 as any)?.asset_id ?? null;
      if (currentAssetId) {
        const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentSend } = await supabase
          .from("execution_actions")
          .select("id")
          .eq("campaign_id", id)
          .eq("contact_email", contactEmail)
          .eq("asset_id", currentAssetId)
          .gte("acted_on_at", since7d)
          .limit(1)
          .maybeSingle();
        if (recentSend) {
          return { passed: false, reason: "Cet asset a déjà été envoyé à ce contact il y a moins de 7 jours.", guardrail: "asset_not_already_sent" };
        }
      }

      // G4 — contact_valid
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactEmail)) {
        return { passed: false, reason: "L'email de ce contact semble invalide. Vérifiez les informations.", guardrail: "contact_valid" };
      }
    }

    return { passed: true, reason: null, guardrail: null };
  };

  const handleNBAMarkDone = async () => {
    if (!campaign || !id) return;

    // Validation recommended_action
    const recAct = (dealScore?.recommended_action_v2 as any) ?? (dealScore?.recommended_action as any);
    if (!recAct) {
      setGuardrailBlocked("Aucune action recommandée disponible pour ce deal.");
      return;
    }
    if (!recAct.contact_email && !recAct.asset_id) {
      setGuardrailBlocked("Identifier le contact et l'asset avant d'agir.");
      return;
    }
    if (!recAct.contact_email) {
      setGuardrailBlocked("Identifier le contact cible avant d'agir.");
      return;
    }

    // Fetch pending execution_action (one-time token)
    const { data: fetchedAction } = await supabase
      .from("execution_actions")
      .select("id, execution_token, token_expires_at, contact_email, asset_id")
      .eq("campaign_id", id)
      .eq("guardrail_status", "pending")
      .is("acted_on_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const contactEmail = fetchedAction?.contact_email ?? recAct.contact_email ?? null;

    // Token expired?
    if (fetchedAction?.token_expires_at && new Date(fetchedAction.token_expires_at) < new Date()) {
      setTokenExpired(true);
      return;
    }

    // Run guardrails
    const guardrailResult = await checkGuardrails(contactEmail);
    if (!guardrailResult.passed) {
      setGuardrailBlocked(guardrailResult.reason);
      if (fetchedAction?.id) {
        await supabase.from("execution_actions")
          .update({ guardrail_status: "blocked", guardrail_reason: guardrailResult.guardrail })
          .eq("id", fetchedAction.id);
      }
      return;
    }

    setGuardrailBlocked(null);

    // All guardrails passed → mark as executed (UPDATE, not INSERT)
    try {
      if (fetchedAction?.id) {
        await supabase.from("execution_actions")
          .update({
            guardrail_status: "passed",
            executed_from: "app",
            executed_by: "ae",
            acted_on_at: new Date().toISOString(),
            contact_email: contactEmail,
          })
          .eq("id", fetchedAction.id);
      }

      // Also mark first_action_completed_at on campaign
      await supabase.from("campaigns").update({
        first_action_completed_at: new Date().toISOString(),
      }).eq("id", campaign.id);
      setCampaign(prev => prev ? { ...prev, first_action_completed_at: new Date().toISOString() } as any : null);
      setActionConfirmed(true);
      toast.success("Action notée — Ekko surveille la suite");
    } catch { toast.error("Erreur"); }
  };

  // C3 — Handler correction AE ✗
  const handleRejectInsight = async (contradictionId: string) => {
    if (processingAlerts.has(contradictionId)) return;
    setProcessingAlerts(prev => new Set([...prev, contradictionId]));

    setPendingDismiss(prev => new Set([...prev, contradictionId]));
    setFeedbackMessages(prev => ({ ...prev, [contradictionId]: "rejected" }));

    const timer = setTimeout(() => {
      setDismissedAlerts(prev => new Set([...prev, contradictionId]));
      setPendingDismiss(prev => { const next = new Set(prev); next.delete(contradictionId); return next; });
      setFeedbackMessages(prev => { const next = { ...prev }; delete next[contradictionId]; return next; });
      setProcessingAlerts(prev => { const next = new Set(prev); next.delete(contradictionId); return next; });
      delete dismissTimersRef.current[contradictionId];
    }, 3000);
    dismissTimersRef.current[contradictionId] = timer;

    try {
      if (!campaign?.id) return;
      await supabase.from("system_failures").insert({
        campaign_id: campaign.id,
        failure_type: "inference_error",
        severity: "low",
        message: `AE a rejeté l'insight ${contradictionId}`,
        reason: contradictionId,
      });

      const { count } = await supabase
        .from("system_failures")
        .select("id", { count: "exact" })
        .eq("campaign_id", campaign.id)
        .eq("failure_type", "inference_error")
        .eq("reason", contradictionId);

      // SIMPLIFICATION V1 : downgrade global sur le deal, pas ciblé sur la contradiction.
      // Jamais downgrader source='declared' — priorité absolue de l'AE.
      if ((count ?? 0) >= 2) {
        await supabase
          .from("deal_contact_roles")
          .update({ confidence: 0.3 })
          .eq("campaign_id", campaign.id)
          .neq("source", "declared");
      }
    } catch (err) {
      console.error("[C3][handleRejectInsight]", err);
    }
  };

  // C3 — Handler confirmation AE ✓
  const handleConfirmInsight = async (contradictionId: string) => {
    if (processingAlerts.has(contradictionId)) return;
    setProcessingAlerts(prev => new Set([...prev, contradictionId]));

    // NOTE: confirmedAlerts is UI-only (local). Persistence comes from upsert deal_contact_roles below.
    setConfirmedAlerts(prev => new Set([...prev, contradictionId]));
    setFeedbackMessages(prev => ({ ...prev, [contradictionId]: "confirmed" }));

    setTimeout(() => {
      setFeedbackMessages(prev => { const next = { ...prev }; delete next[contradictionId]; return next; });
      setProcessingAlerts(prev => { const next = new Set(prev); next.delete(contradictionId); return next; });
    }, 2000);

    try {
      if (!campaign?.id) return;
      const topViewer = viewers
        .filter((v: any) => (v.contact_score ?? 0) > 0)
        .sort((a: any, b: any) => (b.contact_score ?? 0) - (a.contact_score ?? 0))[0];

      if (topViewer) {
        await supabase.from("deal_contact_roles").upsert({
          campaign_id: campaign.id,
          viewer_id: topViewer.id,
          source: "declared",
          confidence: 0.95,
          insight_reasons: JSON.stringify([`AE a confirmé l'insight ${contradictionId}`]),
        }, { onConflict: "campaign_id,viewer_id" });
      }
    } catch (err) {
      console.error("[C3][handleConfirmInsight]", err);
    }
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
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[#0D1B2A]">{campaign.name}</h1>
              {dealValue && <span className="text-lg font-semibold text-muted-foreground">{(dealValue / 1000).toFixed(0)}k€</span>}
              {/* BUG 4 — Deal master state badge */}
              {(() => {
                const stCfg = DEAL_STATE_CONFIG[dealMasterState];
                return (
                  <Badge variant="outline" className={cn("text-xs font-semibold border", stCfg.cls)}>
                    {stCfg.emoji} {stCfg.label}
                  </Badge>
                );
              })()}
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
              {lastUpdate ? `Dernière activité : ${lastUpdate}` : "Aucune activité prospect"}
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              Analyse mise à jour {lastUpdate}
            </p>
          </div>
          <div className="flex gap-2">
            {/* BUG 5 — "Voir en tant que prospect" in header */}
            <Button variant="outline" size="sm" onClick={() => window.open(`/lp/${id}?preview=true`, "_blank")}>
              <Eye className="mr-2 h-3.5 w-3.5" />
              Voir en tant que prospect
            </Button>
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
          <TabsTrigger value="assets">{(campaign as any).first_signal_at ? "Contenus envoyés" : "Contenus du deal"}</TabsTrigger>
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
                signalFreshness={signalFreshness}
                whyLineDeclared={
                  safeAgentContext.decision_window
                    ? `Fenêtre de décision : ${safeFormatDate(safeAgentContext.decision_window, "d MMMM", { locale: fr })}`
                    : undefined
                }
              />
            </SectionGuard>
          )}

          {/* E3 — Guardrail blocked message */}
          {guardrailBlocked && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{guardrailBlocked}</p>
              <button
                onClick={() => setGuardrailBlocked(null)}
                className="text-[10px] text-muted-foreground underline mt-1"
              >
                Compris
              </button>
            </div>
          )}

          {/* E3 — Token expired */}
          {tokenExpired && !guardrailBlocked && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Cette action a expiré.{" "}
                <button
                  onClick={async () => {
                    await supabase.functions.invoke("deal-trigger-notify", {
                      body: { campaign_id: id, force_refresh: true },
                    });
                    setTokenExpired(false);
                  }}
                  className="underline text-foreground"
                >
                  Relancer
                </button>
              </p>
            </div>
          )}

          {/* E3 — Action confirmed */}
          {actionConfirmed && (
            <p className="text-xs text-accent px-1">Action enregistrée.</p>
          )}

          {/* Pourquoi — Insights compressés inline */}
          <SectionGuard name="Insights">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pourquoi</p>
              <div className="space-y-1.5">
                {(dealScore?.alerts as any[] || [])
                  .filter((alert: any) => !dismissedAlerts.has(alert.contradiction_id))
                  .slice(0, 2).length > 0
                  ? (dealScore.alerts as any[])
                      .filter((alert: any) => !dismissedAlerts.has(alert.contradiction_id))
                      .slice(0, 2)
                      .map((alert: any, i: number) => {
                        const isConfirmed = confirmedAlerts.has(alert.contradiction_id);
                        const isPending = pendingDismiss.has(alert.contradiction_id);
                        const isProcessing = processingAlerts.has(alert.contradiction_id);
                        const feedback = feedbackMessages[alert.contradiction_id];

                        // insight_reasons : heuristique frontend V1
                        // DOCTRINE C3 : placeholder — branchement deal_contact_roles.insight_reasons en D3
                        const reasons: string[] = [];
                        viewers.slice(0, 3).forEach((v: any) => {
                          if (v.name) reasons.push(v.name);
                          else if (v.title) reasons.push(v.title);
                        });
                        if (daysSinceSignal !== undefined && daysSinceSignal > 0 && daysSinceSignal < 90)
                          reasons.push(`${daysSinceSignal}j sans signal`);
                        else if (daysSinceSignal !== undefined && daysSinceSignal >= 90)
                          reasons.push("Aucun signal reçu");
                        if ((campaign as any)?.deal_value)
                          reasons.push(`${Math.round(((campaign as any).deal_value) / 1000)}k€`);
                        const reasonsText = reasons.slice(0, 4).join(" · ");

                        return (
                          <div key={alert.contradiction_id} className="space-y-1">
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className={
                                i === 0
                                  ? "text-[10px] px-1.5 py-0 shrink-0 bg-[#F7F6F3] text-[#0D1B2A] border-[#D1D5DB]"
                                  : "text-[10px] px-1.5 py-0 shrink-0 bg-[#F7F6F3] text-muted-foreground border-[#D1D5DB] opacity-70"
                              }>
                                SIGNAL
                              </Badge>
                              <p className="text-sm text-foreground leading-snug flex-1">{alert.message}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                {feedback === "rejected" && (
                                  <span className="text-[10px] font-medium text-amber-600 italic">
                                    Compris. Je m'ajuste.
                                  </span>
                                )}
                                {feedback === "confirmed" && (
                                  <span className="text-[10px] font-medium text-emerald-600">
                                    Confirmé
                                  </span>
                                )}
                                {!feedback && !isConfirmed && !isPending && (
                                  <>
                                    <button
                                      onClick={() => handleConfirmInsight(alert.contradiction_id)}
                                      disabled={isProcessing}
                                      className="text-emerald-600 hover:text-emerald-700 text-xs px-1.5 py-0.5 rounded border border-emerald-200 hover:bg-emerald-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Confirmer cet insight"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={() => handleRejectInsight(alert.contradiction_id)}
                                      disabled={isProcessing}
                                      className="text-red-500 hover:text-red-600 text-xs px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Corriger cet insight"
                                    >
                                      ✗
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {reasonsText && (
                              <p className="text-[11px] text-muted-foreground ml-8 leading-snug">
                                {reasonsText}
                              </p>
                            )}
                          </div>
                        );
                      })
                  : <>
                      {/* fallback hardcodé — FAIT/INFÉRENCE ≈ conservés car nature épistémique connue */}
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-[#F7F6F3] text-[#0D1B2A] border-[#D1D5DB]">FAIT</Badge>
                        <p className="text-sm text-foreground leading-snug">
                          {viewers.length === 0
                            ? "Aucun relais interne identifié — vigilance requise"
                            : `${viewers.length} contact${viewers.length !== 1 ? "s" : ""} identifié${viewers.length !== 1 ? "s" : ""}`}
                          {daysSinceSignal !== undefined && daysSinceSignal >= 90
                            ? ""
                            : daysSinceSignal !== undefined && daysSinceSignal > 7
                              ? ` · Deal qui refroidit — aucune activité depuis ${daysSinceSignal}j`
                              : daysSinceSignal !== undefined && daysSinceSignal > 0
                                ? ` · aucune activité depuis ${daysSinceSignal}j`
                                : ""}
                          {" · "}{stageLabel}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-[#FAEEDA] text-[#E8A838] border-[#F5D08A]">INFÉRENCE ≈</Badge>
                        <p className="text-sm text-foreground leading-snug">{`Profil acheteur : remplacement ${safeAgentContext.incumbent_type === "competitor_named" ? "concurrent identifié" : safeAgentContext.incumbent_type === "internal_tool" ? "outil interne" : "incumbent inconnu"} · ${safeAgentContext.competitive_situation || "—"}`}</p>
                      </div>
                    </>
                }
              </div>
            </div>
          </SectionGuard>

          {/* Dernier signal — always visible, one discreet line */}
          <SectionGuard name="DernierSignal">
            {displayEvents.length > 0 ? (
              <p className="text-xs text-muted-foreground px-1">
                Dernier signal : {displayEvents[0].label} · {displayEvents[0].time}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground px-1">Aucun signal reçu.</p>
            )}
          </SectionGuard>

          {/* Widget signal offline AE */}
          <SectionGuard name="OfflineSignalQuick">
            <Card className="shadow-none">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-semibold">Que s'est-il passé ?</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "call_positive", label: "Call positif" },
                    { key: "call_negative", label: "Call négatif" },
                    { key: "new_contact", label: "Nouveau contact identifié" },
                    { key: "other", label: "Autre" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handleOfflineSignal(key, label)}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-accent/40 hover:bg-accent/5 hover:text-foreground transition-all"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {offlineSignalSent && (
                  <p className="text-xs text-accent mt-2">Signal enregistré.</p>
                )}
                {/* Input libre */}
                <div className="flex gap-2 mt-3">
                  <textarea
                    value={freeSignalText}
                    onChange={(e) => setFreeSignalText(e.target.value)}
                    placeholder="Autre chose à ajouter ? (call, réunion, info reçue…)"
                    maxLength={1000}
                    rows={2}
                    className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
                  />
                  <button
                    onClick={handleFreeSignal}
                    disabled={freeSignalLoading || !freeSignalText.trim()}
                    className="self-end px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-medium disabled:opacity-40 hover:bg-accent/90 transition-all"
                  >
                    {freeSignalLoading ? "Traitement…" : "Enregistrer"}
                  </button>
                </div>
                {freeSignalStatus === "success" && detectedContacts.length === 0 && (
                  <p className="text-[10px] text-accent mt-1">Signal enregistré.</p>
                )}
                {freeSignalStatus === "success" && detectedContacts.length > 0 && (
                  <div className="mt-2 p-2 rounded-lg border border-blue-200 bg-blue-50/40">
                    <p className="text-[11px] font-medium" style={{ color: "#3B82F6" }}>
                      Signal enregistré — Contact détecté : {detectedContacts.join(", ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Visible dans la PowerMap · Ajoutez le nom complet si disponible.
                    </p>
                  </div>
                )}
                {freeSignalStatus === "error" && (
                  <p className="text-[10px] text-destructive mt-1">Erreur d'enregistrement.</p>
                )}
              </CardContent>
            </Card>
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
              {!timelineOpen && displayEvents.length > 0 && (
                <CardContent className="pt-0 px-4 pb-3">
                  <p className="text-xs text-muted-foreground truncate">
                    {displayEvents[0].label} · {displayEvents[0].time}
                  </p>
                </CardContent>
              )}
              {!timelineOpen && displayEvents.length === 0 && (
                <CardContent className="pt-0 px-4 pb-3">
                  <p className="text-xs text-muted-foreground">Aucun événement enregistré.</p>
                </CardContent>
              )}
              {displayEvents.length > 0 ? (
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-out",
                    timelineOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <CardContent className="pt-0 px-3">
                    <DealTimeline events={displayEvents} />
                  </CardContent>
                </div>
              ) : timelineOpen ? (
                <CardContent className="pt-0 px-3">
                  <p className="text-sm text-muted-foreground">Aucun écho identifié pour le moment.</p>
                  <p className="text-xs text-muted-foreground mt-1">Tout contenu partagé devient un capteur.</p>
                </CardContent>
              ) : null}
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
                  {daysSinceSignal !== undefined && daysSinceSignal > 5 && daysSinceSignal < 90
                    ? `Aucune activité depuis ${daysSinceSignal}j — que s'est-il passé ?`
                    : "Aucun signal reçu pour le moment."}
                </p>
              </CardContent>
              <div id="offline-signal-widget" data-offline-content className="hidden">
                <CardContent className="pt-0 px-3">
                  <WhatHappenedWidget campaignId={campaign.id} />
                </CardContent>
              </div>
            </Card>
          </SectionGuard>
        </TabsContent>

        {/* ─── Tab 2: Deal Intelligence ─── */}
        <TabsContent value="intelligence" className="space-y-6">
          {/* B3 — Questions clés */}
          <SectionGuard name="QuestionsClés">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#0D1B2A]">Questions clés</p>

              <Card className="shadow-none">
                <CardContent className="py-3 px-4">
                  <p className="text-xs font-medium text-[#0D1B2A] mb-1">Qui regarde ?</p>
                  <p className="text-sm text-muted-foreground">{q1Text}</p>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardContent className="py-3 px-4">
                  <p className="text-xs font-medium text-[#0D1B2A] mb-1">Qui ne regarde pas ?</p>
                  <p className="text-sm text-muted-foreground">{q2Text}</p>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardContent className="py-3 px-4">
                  <p className="text-xs font-medium text-[#0D1B2A] mb-1">Qui a lu ce qui compte ?</p>
                  {q3Loading ? (
                    <EkkoLoader mode="loop" size={16} />
                  ) : (
                    <>
                      {q3Result.lines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucun asset critique envoyé sur ce deal.</p>
                      ) : (
                        q3Result.lines.map((line, i) => (
                          <p key={i} className="text-sm text-muted-foreground">{line}</p>
                        ))
                      )}
                      {q3Result.videoActivity && (
                        <p className="text-sm text-muted-foreground mt-1">{q3Result.videoActivity}</p>
                      )}
                      {q3Result.hasVideoAssets && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Mesure actuelle : niveau deal. Le suivi par asset vidéo individuel sera disponible ultérieurement.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardContent className="py-3 px-4">
                  <p className="text-xs font-medium text-[#0D1B2A] mb-1">Qui vient d'apparaître ?</p>
                  <p className="text-sm text-muted-foreground">{q4Text}</p>
                </CardContent>
              </Card>
            </div>
          </SectionGuard>

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
                  <PowerMap campaignId={campaign.id} orgId={membership?.org_id || ""} viewers={viewers} committeeLayers={committeeLayers} />
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
                                <Button size="sm" className="rounded-cta bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => { if (!id) { console.error("campaignId manquant"); return; } navigate(`/app/share?campaignId=${id}`); }}>
                                  <Video className="mr-2 h-3.5 w-3.5" /> Envoyer une vidéo
                                </Button>
                                <Button size="sm" variant="outline" className="rounded-cta" onClick={() => { if (!id) { console.error("campaignId manquant"); return; } navigate(`/app/share?campaignId=${id}`); }}>
                                  <FileText className="mr-2 h-3.5 w-3.5" /> Partager un document
                                </Button>
                                <Button size="sm" variant="outline" className="rounded-cta" onClick={() => { if (!id) { console.error("campaignId manquant"); return; } navigate(`/app/share?campaignId=${id}`); }}>
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
                          <div className="flex gap-1.5">
                            {/* BUG 1 — Prévisualiser */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="sm" onClick={() => window.open(`/lp/${id}?preview=true`, "_blank")}>
                                    <Eye className="h-3.5 w-3.5 mr-1" /> Prévisualiser
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ouvrir la landing page en mode prévisualisation</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {/* BUG 1 — Copier le lien prospect */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                   <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!hasReadyAsset || isGeneratingLink}
                                    className={cn((!hasReadyAsset || isGeneratingLink) && "opacity-50 cursor-not-allowed")}
                                    onClick={async () => {
                                      if (!hasReadyAsset || !id) return;
                                      setIsGeneratingLink(true);
                                      try {
                                        const { data: assets } = await supabase
                                          .from("deal_assets").select("id")
                                          .eq("campaign_id", id).eq("asset_status", "valid")
                                          .order("created_at", { ascending: false }).limit(1);
                                        const primaryAsset = assets?.[0];
                                        if (!primaryAsset) {
                                          toast.error("Aucun asset prêt à partager sur ce deal.");
                                          return;
                                        }
                                        const { data, error } = await supabase.functions.invoke("create-tracked-link", {
                                          body: { campaign_id: id, asset_id: primaryAsset.id }
                                        });
                                        if (error || !data?.tracked_url) throw error;
                                        await navigator.clipboard.writeText(data.tracked_url);
                                        toast.success("Lien tracké copié");
                                      } catch {
                                        await navigator.clipboard.writeText(`${window.location.origin}/lp/${id}`);
                                        toast.success("Lien copié");
                                      } finally {
                                        setIsGeneratingLink(false);
                                      }
                                    }}
                                  >
                                    {isGeneratingLink
                                      ? <EkkoLoader mode="once" size={12} />
                                      : <Link className="h-3.5 w-3.5 mr-1" />
                                    }
                                    {" "}Copier le lien prospect
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {hasReadyAsset ? "Copier le lien de la landing page prospect" : "Ajoutez au moins un contenu prêt pour partager le lien"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {/* Actions existantes conservées */}
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
        dealScore={dealScore}
        onSuccess={() => {
          setCampaign(prev => prev ? { ...prev, deal_status: "closed" } : null);
        }}
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

      {/* E2 — Contextual toast for silent deals */}
      {showContextualToast && contextualDealName && (
        <div className="fixed bottom-6 right-6 z-50 max-w-xs animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-start gap-3 bg-card border border-border rounded-xl shadow-lg px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Des news sur{" "}
                <span className="font-semibold">{contextualDealName}</span> ?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Aucun signal depuis +7j.</p>
            </div>
            <button
              onClick={() => setShowContextualToast(false)}
              className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
            >
              ✕
            </button>
          </div>
          <button
            onClick={() => {
              setShowContextualToast(false);
              document.getElementById("offline-signal-widget")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="mt-2 text-xs hover:underline"
            style={{ color: "#1AE08A" }}
          >
            Mettre à jour →
          </button>
        </div>
      )}
    </AppLayout>
  );
}
