import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { VideoEditor } from "@/components/video-editor/VideoEditor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { Campaign, Video } from "@/types/database";

const FALLBACK_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
const DEMO_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

function getVideoUrl(video?: Video | null): string {
  if (!video) return FALLBACK_VIDEO_URL;
  const metadata = video.metadata as Record<string, unknown> | null;
  if (metadata?.hosted_url) return metadata.hosted_url as string;
  if (metadata?.stream_url) return metadata.stream_url as string;
  if (metadata?.download_url) return metadata.download_url as string;
  if (video.storage_path?.startsWith("http")) return video.storage_path;
  return FALLBACK_VIDEO_URL;
}

export default function VideoEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { membership } = useAuthContext();

  const isDemo = !id;

  const [isLoading, setIsLoading] = useState(!isDemo);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [videoUrl, setVideoUrl] = useState(isDemo ? DEMO_VIDEO_URL : FALLBACK_VIDEO_URL);
  const [initialProject, setInitialProject] = useState<string | undefined>();

  useEffect(() => {
    if (isDemo) return;
    const fetchData = async () => {
      if (!id || !membership?.org_id) return;

      try {
        const { data: campaignData } = await supabase
          .from("campaigns")
          .select("*, identities(display_name)")
          .eq("id", id)
          .eq("org_id", membership.org_id)
          .single();

        if (!campaignData) {
          toast.error("Campagne non trouvée");
          navigate("/app/campaigns");
          return;
        }

        setCampaign(campaignData as Campaign);

        const metadata = campaignData.metadata as Record<string, unknown> | null;
        if (metadata?.editorProject) {
          setInitialProject(JSON.stringify(metadata.editorProject));
        }

        const { data: videos } = await supabase
          .from("videos")
          .select("*")
          .eq("campaign_id", id)
          .eq("org_id", membership.org_id)
          .limit(1);

        setVideoUrl(getVideoUrl(videos?.[0] as Video | undefined));
      } catch (error) {
        console.error("Error:", error);
        toast.error("Erreur lors du chargement");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, membership?.org_id, navigate, isDemo]);

  const handleSave = async (projectJson: string) => {
    if (isDemo) {
      toast.success("Projet démo sauvegardé (local uniquement)");
      return;
    }
    if (!campaign || !membership?.org_id) return;

    try {
      const currentMetadata = (campaign.metadata || {}) as Record<string, unknown>;
      const updatedMetadata = JSON.parse(JSON.stringify({
        ...currentMetadata,
        editorProject: JSON.parse(projectJson),
      }));

      const { error } = await supabase
        .from("campaigns")
        .update({ metadata: updatedMetadata })
        .eq("id", campaign.id)
        .eq("org_id", membership.org_id);

      if (error) throw error;

      setCampaign((prev) => (prev ? { ...prev, metadata: updatedMetadata } : null));
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Chargement de l'éditeur...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="h-16 border-b flex items-center px-4 gap-3 bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(isDemo ? "/app/campaigns" : `/app/campaigns/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold truncate">
            Éditeur — {isDemo ? "Mode démo" : campaign?.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isDemo ? "Vidéo de démonstration" : (campaign as any)?.identities?.display_name}
          </p>
        </div>
      </div>

      <VideoEditor
        videoUrl={videoUrl}
        onSave={handleSave}
        initialProject={initialProject}
      />
    </div>
  );
}
