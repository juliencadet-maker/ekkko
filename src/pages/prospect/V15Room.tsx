import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DealRoomGreeting } from "@/components/prospect/v15/DealRoomGreeting";
import {
  DealRoomIdentification,
  type IdentificationResult,
} from "@/components/prospect/v15/DealRoomIdentification";
import { PdfReaderTracked } from "@/components/prospect/v15/PdfReaderTracked";
import { ForwardMagnetForm } from "@/components/prospect/v15/ForwardMagnetForm";
import { SoftIdentifyTriggers } from "@/components/prospect/v15/SoftIdentifyTriggers";

interface V15RoomProps {
  campaignId: string;
}

interface V3Payload {
  video_signed_url?: string | null;
  audio_signed_url?: string | null;
  campaign_name?: string | null;
  company_display_name?: string | null;
  prospect_message?: string | null;
  experience_mode?: string;
  topics_enabled?: string[];
  secondary_assets?: Array<{ id: string; asset_type: string; file_url: string; asset_purpose?: string }>;
  resolved_viewer?: { name?: string } | null;
}

/**
 * Phase 1d — Deal Room V1.5 surface prospect (orchestrateur).
 * Composé de : Greeting + Identification + Vidéo + PDF tracké + Forward Magnet + soft triggers.
 */
export function V15Room({ campaignId }: V15RoomProps) {
  const [data, setData] = useState<V3Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoSeconds, setVideoSeconds] = useState(0);
  const [identification, setIdentification] = useState<IdentificationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: payload, error: err } = await supabase.functions.invoke(
          "get-public-video-v3",
          { body: { campaign_id: campaignId } }
        );
        if (cancelled) return;
        if (err) {
          setError("Cette Deal Room n'est pas accessible.");
          return;
        }
        setData(payload as V3Payload);
      } catch {
        if (!cancelled) setError("Erreur de chargement.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <p className="text-foreground/80">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const pdfAssets = (data.secondary_assets || []).filter(
    (a) => a.asset_type === "pdf" || a.file_url?.toLowerCase().endsWith(".pdf")
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SoftIdentifyTriggers
        campaignId={campaignId}
        videoPlaybackSeconds={videoSeconds}
      />

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        {/* Greeting */}
        <DealRoomGreeting companyDisplayName={data.company_display_name} />

        {data.prospect_message && (
          <p className="text-foreground/80 leading-relaxed">{data.prospect_message}</p>
        )}

        {/* Identification 3 couches */}
        {!identification && (
          <DealRoomIdentification
            knownViewerName={data.resolved_viewer?.name || null}
            topicsAvailable={data.topics_enabled || []}
            onIdentify={setIdentification}
          />
        )}

        {/* Vidéo principale */}
        {data.video_signed_url && (
          <div className="rounded-xl overflow-hidden border border-border bg-muted">
            <video
              src={data.video_signed_url}
              controls
              className="w-full aspect-video"
              onTimeUpdate={(e) => setVideoSeconds(Math.floor(e.currentTarget.currentTime))}
            />
          </div>
        )}

        {/* Documents */}
        {pdfAssets.map((asset) => (
          <PdfReaderTracked
            key={asset.id}
            campaignId={campaignId}
            assetId={asset.id}
            pdfUrl={asset.file_url}
            fileName={asset.asset_purpose || "Document"}
          />
        ))}

        {/* Forward Magnet */}
        <ForwardMagnetForm campaignId={campaignId} />
      </div>
    </div>
  );
}
