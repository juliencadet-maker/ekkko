import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import type { Campaign, Video as VideoType, Recipient } from "@/types/database";

// Fallback video URL when no Tavus video is available
const FALLBACK_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

// Get the best video URL from a video record
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

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { membership } = useAuthContext();

  const [isLoading, setIsLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [videos, setVideos] = useState<(VideoType & { recipient?: Recipient })[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLandingPageEditor, setShowLandingPageEditor] = useState(false);
  const [landingPageConfig, setLandingPageConfig] = useState<LandingPageConfig | undefined>();
  const [viewEvents, setViewEvents] = useState<ViewEvent[]>([]);
  const [watchProgress, setWatchProgress] = useState<WatchProgressRow[]>([]);

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
        
        // Load landing page config from metadata
        const metadata = campaignData.metadata as Record<string, unknown> | null;
        if (metadata?.landingPageConfig) {
          setLandingPageConfig(metadata.landingPageConfig as LandingPageConfig);
        }

        // Fetch videos for this campaign
        const { data: videosData, error: videosError } = await supabase
          .from("videos")
          .select("*, recipients(first_name, last_name, email, company)")
          .eq("campaign_id", id)
          .eq("org_id", membership.org_id);

        if (videosError) throw videosError;
        setVideos(videosData as (VideoType & { recipient?: Recipient })[]);

        // Fetch analytics data from real tables
        const videoIds = (videosData || []).map((v: { id: string }) => v.id);
        if (videoIds.length > 0) {
          const [viewEventsRes, watchProgressRes] = await Promise.all([
            supabase
              .from("view_events")
              .select("*")
              .in("video_id", videoIds),
            supabase
              .from("watch_progress")
              .select("*")
              .in("video_id", videoIds),
          ]);
          if (viewEventsRes.data) setViewEvents(viewEventsRes.data as ViewEvent[]);
          if (watchProgressRes.data) setWatchProgress(watchProgressRes.data as WatchProgressRow[]);
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

  // ── Compute real KPIs from fetched data ──
  const kpis = useMemo(() => {
    const totalViews = viewEvents.length;
    const uniqueViewers = new Set(watchProgress.map((w) => w.viewer_hash)).size;
    const avgWatchTime = watchProgress.length > 0
      ? Math.round(watchProgress.reduce((s, w) => s + w.total_watch_seconds, 0) / watchProgress.length)
      : 0;
    const completionRate = watchProgress.length > 0
      ? Math.round(watchProgress.filter((w) => w.max_percentage_reached >= 90).length / watchProgress.length * 100)
      : 0;
    const shareCount = new Set(watchProgress.filter((w) => w.referred_by_hash).map((w) => w.referred_by_hash)).size;
    const totalSessions = watchProgress.reduce((s, w) => s + w.session_count, 0);
    const avgSessions = watchProgress.length > 0 ? +(totalSessions / watchProgress.length).toFixed(1) : 0;
    const avgMaxReached = watchProgress.length > 0
      ? Math.round(watchProgress.reduce((s, w) => s + w.max_percentage_reached, 0) / watchProgress.length)
      : 0;
    const bounceRate = watchProgress.length > 0
      ? Math.round(watchProgress.filter((w) => w.max_percentage_reached < 10).length / watchProgress.length * 100)
      : 0;

    return { totalViews, uniqueViewers, avgWatchTime, completionRate, shareCount, totalSessions, avgSessions, avgMaxReached, bounceRate };
  }, [viewEvents, watchProgress]);

  const handleSaveLandingPageConfig = async (config: LandingPageConfig) => {
    if (!campaign || !membership?.org_id) return;

    try {
      const currentMetadata = (campaign.metadata || {}) as Record<string, unknown>;
      const updatedMetadata = JSON.parse(JSON.stringify({
        ...currentMetadata,
        landingPageConfig: config,
      }));

      const { error } = await supabase
        .from("campaigns")
        .update({ metadata: updatedMetadata })
        .eq("id", campaign.id)
        .eq("org_id", membership.org_id);

      if (error) throw error;

      setLandingPageConfig(config);
      setCampaign(prev => prev ? { ...prev, metadata: updatedMetadata } : null);
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
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
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
            Retour aux campagnes
          </Button>
        </div>
      </AppLayout>
    );
  }

  const shareLink = generateShareLink();

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/app/campaigns")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux campagnes
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="mt-1 text-muted-foreground">
              {(campaign as any).identities?.display_name || "Identité"} • Créée le {format(new Date(campaign.created_at), "d MMMM yyyy", { locale: fr })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/app/campaigns/${id}/editor`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Éditeur vidéo
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exporter
            </Button>
            <Button>
              <Share2 className="mr-2 h-4 w-4" />
              Partager
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="video">Vidéo</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="powermap">
            <Map className="mr-1.5 h-4 w-4" />
            Power Map
          </TabsTrigger>
          <TabsTrigger value="sharing">Partage</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPIs Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={Eye}
              value={kpis.totalViews.toLocaleString()}
              label="Vues totales"
            />
            <MetricCard
              icon={Users}
              value={kpis.uniqueViewers.toLocaleString()}
              label="Visiteurs uniques"
            />
            <MetricCard
              icon={Clock}
              value={`${kpis.avgWatchTime}s`}
              label="Temps moyen de visionnage"
            />
            <MetricCard
              icon={TrendingUp}
              value={`${kpis.completionRate}%`}
              label="Taux de complétion"
            />
          </div>

          {/* Video Preview & Script */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Video Preview Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Aperçu vidéo
                </CardTitle>
                <CardDescription>
                  Vidéo générée pour cette campagne
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  <video
                    id="campaign-video"
                    src={getVideoUrl(videos[0])}
                    className="w-full h-full object-cover"
                    poster="/placeholder.svg"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                    <Button 
                      size="lg" 
                      variant="secondary"
                      className="rounded-full h-16 w-16"
                      onClick={handleVideoToggle}
                    >
                      {isPlaying ? (
                        <Pause className="h-8 w-8" />
                      ) : (
                        <Play className="h-8 w-8 ml-1" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1">
                    <Input 
                      value={shareLink} 
                      readOnly 
                      className="font-mono text-sm"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyShareLink(shareLink)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => window.open(shareLink, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Script Card */}
            <Card>
              <CardHeader>
                <CardTitle>Script de la campagne</CardTitle>
                <CardDescription>
                  Le texte utilisé pour générer la vidéo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 min-h-[200px]">
                  <p className="text-sm whitespace-pre-wrap">
                    {campaign.script || "Aucun script défini"}
                  </p>
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
              <CardDescription>
                Vidéo personnalisée générée par IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-3xl mx-auto">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                  <video
                    src={getVideoUrl(videos[0])}
                    className="w-full h-full"
                    controls
                    poster="/placeholder.svg"
                  />
                </div>
                <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-center">
                  <div className="flex-1 max-w-md">
                    <label className="text-sm font-medium mb-2 block">Lien de partage</label>
                    <div className="flex gap-2">
                      <Input 
                        value={shareLink} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button 
                        variant="outline"
                        onClick={() => copyShareLink(shareLink)}
                      >
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

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Detailed KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={Eye}
              value={kpis.totalViews.toLocaleString()}
              label="Vues totales"
            />
            <MetricCard
              icon={Users}
              value={kpis.uniqueViewers.toLocaleString()}
              label="Visiteurs uniques"
            />
            <MetricCard
              icon={Share2}
              value={kpis.shareCount.toString()}
              label="Partages (referrals)"
            />
            <MetricCard
              icon={MousePointerClick}
              value={`${kpis.avgMaxReached}%`}
              label="Progression moyenne"
            />
          </div>

          {/* Engagement Stats */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Engagement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Temps moyen de visionnage</span>
                  <span className="font-medium">{kpis.avgWatchTime} secondes</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Taux de complétion (≥90%)</span>
                  <span className="font-medium">{kpis.completionRate}%</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Taux de rebond (&lt;10%)</span>
                  <span className="font-medium">{kpis.bounceRate}%</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Sessions moyennes / viewer</span>
                  <span className="font-medium">{kpis.avgSessions}x</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Détails
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total sessions</span>
                  <span className="font-medium">{kpis.totalSessions}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Vidéos générées</span>
                  <span className="font-medium">{videos.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Progression max moyenne</span>
                  <span className="font-medium">{kpis.avgMaxReached}%</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Referrals uniques</span>
                  <span className="font-medium">{kpis.shareCount}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Power Map Tab */}
        <TabsContent value="powermap" className="space-y-6">
          {membership?.org_id && id && (
            <PowerMap campaignId={id} orgId={membership.org_id} />
          )}
        </TabsContent>

        {/* Sharing Tab */}
        <TabsContent value="sharing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Options de partage</CardTitle>
              <CardDescription>
                Partagez votre vidéo via un lien unique ou intégrez-la sur votre site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Direct Link */}
              <div>
                <label className="text-sm font-medium mb-2 block">Lien direct</label>
                <div className="flex gap-2">
                  <Input 
                    value={shareLink} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button 
                    variant="outline"
                    onClick={() => copyShareLink(shareLink)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copier
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.open(shareLink, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ouvrir
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Embed Code */}
              <div>
                <label className="text-sm font-medium mb-2 block">Code d'intégration</label>
                <div className="bg-muted rounded-lg p-4">
                  <code className="text-xs text-muted-foreground break-all">
                    {`<iframe src="${shareLink}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`}
                  </code>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => {
                    navigator.clipboard.writeText(`<iframe src="${shareLink}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`);
                    toast.success("Code d'intégration copié");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copier le code
                </Button>
              </div>

              <Separator />

              {/* Landing Page */}
              <div>
                <label className="text-sm font-medium mb-2 block">Page de destination personnalisée</label>
                <p className="text-sm text-muted-foreground mb-3">
                  Créez une landing page avec votre vidéo et un call-to-action personnalisé.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setShowLandingPageEditor(true)}>
                    {landingPageConfig ? (
                      <>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier la landing page
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Créer une landing page
                      </>
                    )}
                  </Button>
                  {landingPageConfig && (
                    <Button 
                      variant="outline"
                      onClick={() => window.open(landingPageUrl, '_blank')}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Voir
                    </Button>
                  )}
                </div>
                {landingPageConfig && (
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={landingPageUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(landingPageUrl);
                        toast.success("Lien copié");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Landing Page Editor */}
      {campaign && (
        <LandingPageEditor
          open={showLandingPageEditor}
          onOpenChange={setShowLandingPageEditor}
          campaignId={campaign.id}
          campaignName={campaign.name}
          videoUrl={getVideoUrl(videos[0])}
          initialConfig={landingPageConfig}
          onSave={handleSaveLandingPageConfig}
        />
      )}
    </AppLayout>
  );
}
