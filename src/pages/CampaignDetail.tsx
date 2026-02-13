import { useState, useEffect } from "react";
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
  Pencil
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

  // Mock KPIs for demo
  const mockKPIs = {
    totalViews: 847,
    uniqueViewers: 234,
    avgWatchTime: 45,
    completionRate: 78,
    clickRate: 12.5,
    shareCount: 23,
    viewsTrend: 15,
    clicksTrend: 8,
  };

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

      } catch (error) {
        console.error("Fetch campaign error:", error);
        toast.error("Erreur lors du chargement de la campagne");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaign();
  }, [id, membership?.org_id]);

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
          <TabsTrigger value="sharing">Partage</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPIs Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={Eye}
              value={mockKPIs.totalViews.toLocaleString()}
              label="Vues totales"
              trend={{ value: mockKPIs.viewsTrend, isPositive: true }}
            />
            <MetricCard
              icon={Users}
              value={mockKPIs.uniqueViewers.toLocaleString()}
              label="Visiteurs uniques"
            />
            <MetricCard
              icon={Clock}
              value={`${mockKPIs.avgWatchTime}s`}
              label="Temps moyen de visionnage"
            />
            <MetricCard
              icon={TrendingUp}
              value={`${mockKPIs.completionRate}%`}
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
              value={mockKPIs.totalViews.toLocaleString()}
              label="Vues totales"
              trend={{ value: mockKPIs.viewsTrend, isPositive: true }}
            />
            <MetricCard
              icon={Users}
              value={mockKPIs.uniqueViewers.toLocaleString()}
              label="Visiteurs uniques"
              trend={{ value: 12, isPositive: true }}
            />
            <MetricCard
              icon={MousePointerClick}
              value={`${mockKPIs.clickRate}%`}
              label="Taux de clic"
              trend={{ value: mockKPIs.clicksTrend, isPositive: true }}
            />
            <MetricCard
              icon={Share2}
              value={mockKPIs.shareCount.toString()}
              label="Partages"
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
                  <span className="font-medium">{mockKPIs.avgWatchTime} secondes</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Taux de complétion</span>
                  <span className="font-medium">{mockKPIs.completionRate}%</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Taux de rebond</span>
                  <span className="font-medium">22%</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Replay moyen</span>
                  <span className="font-medium">1.3x</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ouvertures email</span>
                  <span className="font-medium">456</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Clics sur le lien</span>
                  <span className="font-medium">234</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Conversions</span>
                  <span className="font-medium">12</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Taux de conversion</span>
                  <span className="font-medium">5.1%</span>
                </div>
              </CardContent>
            </Card>
          </div>
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
