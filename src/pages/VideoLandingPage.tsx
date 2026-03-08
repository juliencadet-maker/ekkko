import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ShareDialog } from "@/components/landing/ShareDialog";

const MOCK_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

interface LandingPageConfig {
  logoUrl: string | null;
  brandColor: string;
  ctaText: string;
  ctaUrl: string;
  headline: string;
  subheadline: string;
}

const DEFAULT_CONFIG: LandingPageConfig = {
  logoUrl: null,
  brandColor: "#1e3a5f",
  ctaText: "Prendre rendez-vous",
  ctaUrl: "https://calendly.com",
  headline: "Un message personnalisé pour vous",
  subheadline: "Découvrez notre vidéo exclusive",
};

// Generate a stable viewer hash from browser fingerprint
function generateViewerHash(): string {
  const nav = navigator;
  const raw = [nav.userAgent, nav.language, screen.width, screen.height, new Date().getTimezoneOffset()].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export default function VideoLandingPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [searchParams] = useSearchParams();
  const referredBy = searchParams.get("ref");

  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<LandingPageConfig>(DEFAULT_CONFIG);
  const [campaignName, setCampaignName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  // Viewer identification
  const [showIdentForm, setShowIdentForm] = useState(false);
  const [identSubmitted, setIdentSubmitted] = useState(false);
  const [identName, setIdentName] = useState("");
  const [identEmail, setIdentEmail] = useState("");
  const [identTitle, setIdentTitle] = useState("");
  const [identCompany, setIdentCompany] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerHashRef = useRef(generateViewerHash());
  const lastReportedRef = useRef(0);
  const watchSecondsRef = useRef(0);

  useEffect(() => {
    const fetchCampaign = async () => {
      if (!campaignId) {
        setError("Campagne non trouvée");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("campaigns")
          .select("name, metadata")
          .eq("id", campaignId)
          .single();

        if (fetchError) throw fetchError;

        setCampaignName(data.name);
        const metadata = data.metadata as Record<string, unknown> | null;
        if (metadata?.landingPageConfig) {
          setConfig(metadata.landingPageConfig as LandingPageConfig);
        }

        // Fetch video via secure edge function (no direct DB access)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const videoRes = await fetch(`${supabaseUrl}/functions/v1/get-public-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": supabaseKey },
          body: JSON.stringify({ campaign_id: campaignId }),
        });
        const videoData = await videoRes.json();
        if (videoData?.video_id) {
          setVideoId(videoData.video_id);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Cette page n'existe pas ou n'est plus disponible");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId]);

  const reportProgress = useCallback(async (percentage: number) => {
    if (!videoId) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      await fetch(`${supabaseUrl}/functions/v1/track-watch-progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          video_id: videoId,
          viewer_hash: viewerHashRef.current,
          watch_percentage: Math.round(percentage),
          total_watch_seconds: Math.round(watchSecondsRef.current),
          referred_by_hash: referredBy || undefined,
        }),
      });
    } catch {
      // Silently fail - don't interrupt viewing
    }
  }, [videoId, referredBy]);

  // Track video progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoId) return;

    const onTimeUpdate = () => {
      if (!video.duration) return;
      const percentage = (video.currentTime / video.duration) * 100;
      watchSecondsRef.current = video.currentTime;

      // Report every 10% change
      const rounded = Math.floor(percentage / 10) * 10;
      if (rounded > lastReportedRef.current) {
        lastReportedRef.current = rounded;
        reportProgress(percentage);
      }
    };

    const onEnded = () => {
      reportProgress(100);
      // Show identification form after video ends
      if (!identSubmitted) {
        setTimeout(() => setShowIdentForm(true), 1000);
      }
    };

    const onPlay = () => {
      // Show form after 30% viewing
      const checkThreshold = () => {
        if (video.duration && video.currentTime / video.duration > 0.3 && !identSubmitted) {
          setShowIdentForm(true);
        }
      };
      setTimeout(checkThreshold, 5000);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
    };
  }, [videoId, reportProgress, identSubmitted]);

  const handleVideoToggle = () => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleIdentSubmit = async () => {
    if (!identName.trim() || !identEmail.trim()) {
      toast.error("Veuillez remplir au moins votre nom et email");
      return;
    }

    if (!videoId) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      await fetch(`${supabaseUrl}/functions/v1/track-watch-progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          video_id: videoId,
          viewer_hash: viewerHashRef.current,
          watch_percentage: Math.round((videoRef.current?.currentTime || 0) / (videoRef.current?.duration || 1) * 100),
          total_watch_seconds: Math.round(watchSecondsRef.current),
          viewer_name: identName.trim(),
          viewer_email: identEmail.trim(),
          viewer_title: identTitle.trim() || undefined,
          viewer_company: identCompany.trim() || undefined,
          referred_by_hash: referredBy || undefined,
        }),
      });

      setIdentSubmitted(true);
      setShowIdentForm(false);
      toast.success("Merci ! Bonne vidéo 🎬");
    } catch {
      toast.error("Erreur, veuillez réessayer");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Page introuvable</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: config.brandColor + "08" }}
    >
      {/* Header */}
      <header
        className="py-4 px-6 flex items-center justify-center shadow-sm"
        style={{ backgroundColor: config.brandColor }}
      >
        {config.logoUrl ? (
          <img
            src={config.logoUrl}
            alt="Logo"
            className="h-10 max-w-[200px] object-contain brightness-0 invert"
          />
        ) : (
          <div className="h-10 flex items-center text-white font-bold text-xl">
            {campaignName}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-3xl mx-auto text-center">
          <h1
            className="text-2xl md:text-4xl font-bold mb-3"
            style={{ color: config.brandColor }}
          >
            {config.headline}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mb-8">
            {config.subheadline}
          </p>

          {/* Video Player */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl mb-8">
            <video
              ref={videoRef}
              src={MOCK_VIDEO_URL}
              className="w-full h-full object-cover"
              poster="/placeholder.svg"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              playsInline
            />

            {/* Play/Pause overlay */}
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity cursor-pointer ${
                isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"
              }`}
              onClick={handleVideoToggle}
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: config.brandColor }}
              >
                {isPlaying ? (
                  <Pause className="h-10 w-10 text-white" />
                ) : (
                  <Play className="h-10 w-10 text-white ml-1" />
                )}
              </div>
            </div>
          </div>

          {/* Viewer Identification Form */}
          {showIdentForm && !identSubmitted && (
            <Card className="mb-8 text-left max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardContent className="pt-6 space-y-3">
                <p className="text-sm font-medium text-center mb-4">
                  Vous aimez cette vidéo ? Présentez-vous !
                </p>
                <Input
                  placeholder="Votre nom *"
                  value={identName}
                  onChange={(e) => setIdentName(e.target.value)}
                />
                <Input
                  placeholder="Votre email *"
                  type="email"
                  value={identEmail}
                  onChange={(e) => setIdentEmail(e.target.value)}
                />
                <Input
                  placeholder="Titre / Poste"
                  value={identTitle}
                  onChange={(e) => setIdentTitle(e.target.value)}
                />
                <Input
                  placeholder="Entreprise"
                  value={identCompany}
                  onChange={(e) => setIdentCompany(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    style={{ backgroundColor: config.brandColor }}
                    onClick={handleIdentSubmit}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Envoyer
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowIdentForm(false)}
                  >
                    Plus tard
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Share & CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {videoId && campaignId && (
              <ShareDialog
                videoId={videoId}
                campaignId={campaignId}
                senderName={identName || "Un collaborateur"}
                senderViewerHash={viewerHashRef.current}
                brandColor={config.brandColor}
              />
            )}
            <Button
              size="lg"
              className="px-8 py-6 text-lg font-semibold rounded-xl transition-transform hover:scale-105"
              style={{
                backgroundColor: config.brandColor,
                color: "white",
              }}
              onClick={() => window.open(config.ctaUrl, "_blank")}
            >
              {config.ctaText}
              <ExternalLink className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 text-center">
        <p className="text-xs text-muted-foreground">
          Cette vidéo a été générée par IA •
          <a
            href="/"
            className="ml-1 hover:underline"
            style={{ color: config.brandColor }}
          >
            Propulsé par Ekko
          </a>
        </p>
      </footer>
    </div>
  );
}
