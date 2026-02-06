import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mock video URL - placeholder video
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

export default function VideoLandingPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<LandingPageConfig>(DEFAULT_CONFIG);
  const [campaignName, setCampaignName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        
        // Load landing page config from metadata
        const metadata = data.metadata as Record<string, unknown> | null;
        if (metadata?.landingPageConfig) {
          setConfig(metadata.landingPageConfig as LandingPageConfig);
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

  const handleVideoToggle = () => {
    const video = document.getElementById("landing-video") as HTMLVideoElement;
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
          {/* Headlines */}
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
              id="landing-video"
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

          {/* CTA Button */}
          <Button
            size="lg"
            className="px-8 py-6 text-lg font-semibold rounded-xl transition-transform hover:scale-105"
            style={{ 
              backgroundColor: config.brandColor,
              color: "white"
            }}
            onClick={() => window.open(config.ctaUrl, '_blank')}
          >
            {config.ctaText}
            <ExternalLink className="ml-2 h-5 w-5" />
          </Button>
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
