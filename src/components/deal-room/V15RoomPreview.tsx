// Phase 4-fix — V15RoomPreview: read-only sibling of V15Room.
// Same architecture (HeroSection + BlockShell + 7 block components by group)
// but ZERO side-effects: no persistViewer, no PresenceIndicator,
// no useVideoEventTracker, no SoftIdentifyTriggers, no GC-12 revisit,
// no scroll velocity logging, no track-document-events calls.
// Hero video is a native <video> muted+autoplay=false without playback callbacks.
// Used by PublishDealRoomPreview to render a faithful mini preview without
// polluting the prospect's real timeline or presence channel.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BlockShell } from "./BlockShell";
import { DocumentsBlock } from "./blocks/DocumentsBlock";
import { SocialProofBlock } from "./blocks/SocialProofBlock";
import { RoiBlock } from "./blocks/RoiBlock";
import { PricingBlock } from "./blocks/PricingBlock";
import { ReferencesBlock } from "./blocks/ReferencesBlock";
import { OtherBlock } from "./blocks/OtherBlock";
import { CalendlyBlock } from "./blocks/CalendlyBlock";
import { BLOCK_LABELS, BLOCK_ORDER, BlockGroup, V15Asset, V15Payload } from "./types";

interface Props {
  campaignId: string;
  className?: string;
}

const BLOCK_COMPONENTS: Record<BlockGroup, React.ComponentType<any>> = {
  hero_video: () => null,
  documents: DocumentsBlock,
  social_proof: SocialProofBlock,
  roi: RoiBlock,
  pricing: PricingBlock,
  references: ReferencesBlock,
  calendly: () => null,
  other: OtherBlock,
};

export function V15RoomPreview({ campaignId, className }: Props) {
  const [data, setData] = useState<V15Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch payload WITHOUT viewer_hash → resolved_viewer null, no presence,
        // no D2 token resolution. get-public-video-v3 is a pure read function:
        // it does not log timeline events itself.
        const { data: payload, error: err } = await supabase.functions.invoke<V15Payload>(
          "get-public-video-v3",
          { body: { campaign_id: campaignId } },
        );
        if (cancelled) return;
        if (err || !payload) {
          setError("Aperçu indisponible.");
          return;
        }
        setData(payload);
      } catch {
        if (!cancelled) setError("Erreur de chargement de l'aperçu.");
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  if (error) return <div className="p-6 text-xs text-muted-foreground">{error}</div>;
  if (!data) return <div className="p-6 text-xs text-muted-foreground">Chargement de l'aperçu…</div>;

  // Group secondary assets exactly like V15Room.
  const grouped: Partial<Record<BlockGroup, V15Asset[]>> = {};
  for (const a of data.secondary_assets || []) {
    const g = (a.block_group as BlockGroup | null) || "other";
    if (!BLOCK_ORDER.includes(g)) continue;
    if (g === "hero_video") continue;
    if (!grouped[g]) grouped[g] = [];
    grouped[g]!.push(a);
  }
  if (data.calendly_url) grouped.calendly = grouped.calendly || [];

  const orderedBlocks = BLOCK_ORDER
    .filter((g) => g !== "hero_video")
    .filter((g) => g === "calendly" ? !!data.calendly_url : (grouped[g] && grouped[g]!.length > 0))
    .map((g) => {
      const assets = (grouped[g] || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      const customTitle = assets.find((a) => a.block_title)?.block_title;
      const customSubtitle = assets.find((a) => a.block_description)?.block_description ?? null;
      return {
        id: `block-${g}`,
        group: g,
        assets,
        title: customTitle || BLOCK_LABELS[g],
        subtitle: customSubtitle,
      };
    });

  return (
    <div className={`bg-background text-foreground antialiased rounded-md overflow-hidden border ${className ?? ""}`}>
      {/* Mini hero — native <video> muted, no autoplay, no callbacks */}
      <div className="bg-muted/40 px-4 py-4 border-b">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Hero</p>
        {data.video_signed_url ? (
          <video
            src={data.video_signed_url}
            muted
            controls
            playsInline
            className="w-full max-h-48 rounded bg-black"
          />
        ) : (
          <div className="w-full h-32 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
            Vidéo non disponible (preview)
          </div>
        )}
      </div>

      {/* Summary bullets (if present in payload at runtime) */}
      {data.summary_bullets && data.summary_bullets.length > 0 && (
        <div className="px-4 py-3 border-b">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Points clés</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {data.summary_bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Blocks */}
      <div className="px-4 py-3 space-y-4">
        {orderedBlocks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Aucun bloc secondaire configuré.</p>
        ) : orderedBlocks.map((b, i) => {
          const Comp = BLOCK_COMPONENTS[b.group];
          return (
            <BlockShell
              key={b.id}
              id={b.id}
              blockGroup={b.group}
              index={i}
              total={orderedBlocks.length}
              title={b.title}
              subtitle={b.subtitle}
              viewedAt={null}
              campaignId={campaignId}
              orgId={null}
              viewerHash={null}
              prospectEmail={null}
            >
              {b.group === "calendly" ? (
                <CalendlyBlock url={data.calendly_url || null} aeFirstName={data.ae_name?.split(" ")[0] || null} />
              ) : (
                <Comp
                  campaignId={campaignId}
                  assets={b.assets}
                  viewerHash={null}
                  prospectEmail={null}
                  blockGroup={b.group}
                  blockIndex={i}
                  totalBlocks={orderedBlocks.length}
                />
              )}
            </BlockShell>
          );
        })}
      </div>
    </div>
  );
}
