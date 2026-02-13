import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
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
import { LandingPageEditor, LandingPageConfig } from "@/components/campaign/LandingPageEditor";
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
  BarChart3,
  Video,
  Pencil,
  Map,
  Building2,
  Layers,
  ChevronRight,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import type { Campaign, Video as VideoType, Recipient } from "@/types/database";

const FALLBACK_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

function getVideoUrl(video?: VideoType | null): string {
  if (!video) return FALLBACK_VIDEO_URL;
  const metadata = video.metadata as Record<string, unknown> | null;
  if (metadata?.hosted_url) return metadata.hosted_url as string;
  if (metadata?.stream_url) return metadata.stream_url as string;
  if (metadata?.download_url) return metadata.download_url as string;
  if (video.storage_path?.startsWith("http")) return video.storage_path;
  return FALLBACK_VIDEO_URL;
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
  const [showLandingPageEditor, setShowLandingPageEditor] = useState(false);
  const [landingPageConfig, setLandingPageConfig] = useState<LandingPageConfig | undefined>();
  const [viewEvents, setViewEvents] = useState<ViewEvent[]>([]);
  const [watchProgress, setWatchProgress] = useState<WatchProgressRow[]>([]);
  // Sub-campaign analytics (for parent view)
  const [subAnalytics, setSubAnalytics] = useState<
    Record<string, { viewEvents: ViewEvent[]; watchProgress: WatchProgressRow[] }>
  >({});

  const isParent = campaign && !campaign.parent_campaign_id && subCampaigns.length > 0;

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
          setLandingPageConfig(metadata.landingPageConfig as LandingPageConfig);
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
      } catch (error) {
        console.error("Fetch campaign error:", error);
        toast.error("Erreur lors du chargement de la campagne");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaign();
  }, [id, membership?.org_id]);

  const kpis = useMemo(() => computeKpis(viewEvents, watchProgress), [viewEvents, watchProgress]);

  const handleSaveLandingPageConfig = async (config: LandingPageConfig) => {
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
    } catch (error) {
      console.error("Save landing page config error:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const landingPageUrl = id ? `${window.location.origin}/lp/${id}` : "";

  const generateShareLink = (videoId?: string) => {
    const baseUrl = window.location.origin;
    const token = videoId || "demo-token-" + Date.now();
    return `${baseUrl}/v/${token}`;
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
            Retour aux comptes
          </Button>
        </div>
      </AppLayout>
    );
  }

  const shareLink = generateShareLink();
  const backPath = campaign.parent_campaign_id
    ? `/app/campaigns/${campaign.parent_campaign_id}`
    : "/app/campaigns";
  const backLabel = campaign.parent_campaign_id ? "Retour au compte" : "Retour aux comptes";

  // ─── PARENT CAMPAIGN (ACCOUNT) VIEW ────────────────────────────────
  if (isParent) {
    return (
      <AppLayout>
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/app/campaigns")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux comptes
          </Button>

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
            <TabsTrigger value="powermap">
              <Map className="mr-1.5 h-4 w-4" />
              Power Map
            </TabsTrigger>
          </TabsList>

          {/* Overview: Aggregated KPIs + Sub-campaign cards */}
          <TabsContent value="overview" className="space-y-6">
            {/* Aggregate KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={Eye} value={kpis.totalViews.toLocaleString()} label="Vues totales" />
              <MetricCard icon={Users} value={kpis.uniqueViewers.toLocaleString()} label="Visiteurs uniques" />
              <MetricCard icon={Clock} value={`${kpis.avgWatchTime}s`} label="Temps moyen" />
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


          {/* Power Map (aggregated across all sub-campaigns) */}
          <TabsContent value="powermap" className="space-y-6">
            {membership?.org_id && id && <PowerMap campaignId={id} orgId={membership.org_id} />}
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
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>

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
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exporter
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
          const statusLabels: Record<string, string> = { draft: "Brouillon", pending_approval: "Validation", approved: "Approuvé", generating: "Génération", completed: "Prête" };
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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="video">Vidéo</TabsTrigger>
          <TabsTrigger value="powermap">
            <Map className="mr-1.5 h-4 w-4" />
            Power Map
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Eye} value={kpis.totalViews.toLocaleString()} label="Vues totales" />
            <MetricCard icon={Users} value={kpis.uniqueViewers.toLocaleString()} label="Visiteurs uniques" />
            <MetricCard icon={Clock} value={`${kpis.avgWatchTime}s`} label="Temps moyen de visionnage" />
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
                  <video
                    id="campaign-video"
                    src={getVideoUrl(videos.find((v) => v.campaign_id === id))}
                    className="w-full h-full object-cover"
                    poster="/placeholder.svg"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                    <Button size="lg" variant="secondary" className="rounded-full h-16 w-16" onClick={handleVideoToggle}>
                      {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1" />}
                    </Button>
                  </div>
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
        </TabsContent>

        {/* Video Tab */}
        <TabsContent value="video" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vidéo de la campagne</CardTitle>
              <CardDescription>Vidéo personnalisée générée par IA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-3xl mx-auto">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                  <video
                    src={getVideoUrl(videos.find((v) => v.campaign_id === id))}
                    className="w-full h-full"
                    controls
                    poster="/placeholder.svg"
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Power Map Tab */}
        <TabsContent value="powermap" className="space-y-6">
          {membership?.org_id && id && <PowerMap campaignId={id} orgId={membership.org_id} />}
        </TabsContent>

      </Tabs>

      {/* Landing Page Editor */}
      {campaign && (
        <LandingPageEditor
          open={showLandingPageEditor}
          onOpenChange={setShowLandingPageEditor}
          campaignId={campaign.id}
          campaignName={campaign.name}
          videoUrl={getVideoUrl(videos.find((v) => v.campaign_id === id))}
          initialConfig={landingPageConfig}
          onSave={handleSaveLandingPageConfig}
        />
      )}
    </AppLayout>
  );
}
