import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SoftIdentifyTriggers } from "@/components/prospect/v15/SoftIdentifyTriggers";
import { ForwardMagnetForm } from "@/components/prospect/v15/ForwardMagnetForm";
import { DealRoomIdentification, type IdentificationResult } from "@/components/prospect/v15/DealRoomIdentification";

import { HeroSection } from "./HeroSection";
import { StickyTOC, MobileTOC } from "./StickyTOC";
import { AssistantDrawer } from "./AssistantDrawer";
import { TrustBanner } from "./TrustBanner";
import { SmartQuestionPopup } from "./SmartQuestionPopup";
import { BlockShell } from "./BlockShell";
import { PresenceIndicator } from "./PresenceIndicator";
import { SharedCursors } from "./SharedCursors";

import { DocumentsBlock } from "./blocks/DocumentsBlock";
import { SocialProofBlock } from "./blocks/SocialProofBlock";
import { RoiBlock } from "./blocks/RoiBlock";
import { PricingBlock } from "./blocks/PricingBlock";
import { ReferencesBlock } from "./blocks/ReferencesBlock";
import { OtherBlock } from "./blocks/OtherBlock";
import { CalendlyBlock } from "./blocks/CalendlyBlock";

import { BLOCK_LABELS, BLOCK_ORDER, BlockGroup, V15Asset, V15Payload } from "./types";
import { persistViewer, readViewer } from "./lib/viewerHash";

interface Props {
  campaignId: string;
}

const BLOCK_COMPONENTS: Record<BlockGroup, React.ComponentType<any>> = {
  hero_video: () => null,
  documents: DocumentsBlock,
  social_proof: SocialProofBlock,
  roi: RoiBlock,
  pricing: PricingBlock,
  references: ReferencesBlock,
  calendly: () => null, // rendered separately because it needs payload.calendly_url
  other: OtherBlock,
};

export function V15Room({ campaignId }: Props) {
  const [data, setData] = useState<V15Payload | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoSeconds, setVideoSeconds] = useState(0);
  const [videoPaused, setVideoPaused] = useState(true);
  const [identification, setIdentification] = useState<IdentificationResult | null>(null);

  const [viewerHash, setViewerHash] = useState<string | null>(null);
  const [prospectEmail, setProspectEmail] = useState<string | null>(null);

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPulse, setAssistantPulse] = useState(true);

  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const scrollVelocityRef = useRef<{ last: number; ts: number }>({ last: 0, ts: Date.now() });
  const sessionStart = useRef<number>(Date.now());

  // Init viewer from localStorage
  useEffect(() => {
    const v = readViewer(campaignId);
    setViewerHash(v.hash);
    setProspectEmail(v.email);
  }, [campaignId]);

  // Pulse decay
  useEffect(() => {
    const t = setTimeout(() => setAssistantPulse(false), 6000);
    return () => clearTimeout(t);
  }, []);

  // Phase 1d.5g — GC-12 revisit detection (cooldown 1h).
  useEffect(() => {
    if (!campaignId) return;
    try {
      const k = `ekko_dr_last_visit_${campaignId}`;
      const prev = parseInt(localStorage.getItem(k) || "0", 10);
      const now = Date.now();
      if (prev && now - prev > 60 * 60 * 1000) {
        void supabase.functions.invoke("track-document-events", {
          body: {
            campaign_id: campaignId,
            event_type: "dr_revisit",
            viewer_hash: viewerHash,
            metadata: { hours_since_last_visit: Math.round((now - prev) / 3600000) },
          },
        }).catch(() => {});
      }
      localStorage.setItem(k, String(now));
    } catch { /* ignore */ }
  }, [campaignId, viewerHash]);

  // Phase 1d.5g — beforeunload session_end via sendBeacon.
  useEffect(() => {
    const handler = () => {
      try {
        const url = `https://kqpbsznldzrklnnbqtwq.supabase.co/functions/v1/track-document-events`;
        const body = JSON.stringify({
          campaign_id: campaignId,
          event_type: "dr_session_end",
          viewer_hash: viewerHash,
          metadata: {
            duration_seconds: Math.floor((Date.now() - sessionStart.current) / 1000),
            blocks_viewed: viewedIds.size,
          },
        });
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon?.(url, blob);
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [campaignId, viewerHash, viewedIds]);

  // Fetch payload
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: payload, error: err } = await supabase.functions.invoke<V15Payload>(
          "get-public-video-v3",
          { body: { campaign_id: campaignId, viewer_hash: viewerHash } }
        );
        if (cancelled) return;
        if (err || !payload) {
          setError("Cette Deal Room n'est pas accessible.");
          return;
        }
        setData(payload);
        const { data: c } = await supabase
          .from("campaigns")
          .select("org_id")
          .eq("id", campaignId)
          .maybeSingle();
        setOrgId(c?.org_id ?? null);
      } catch {
        if (!cancelled) setError("Erreur de chargement.");
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId, viewerHash]);

  // Identification → derive viewer_hash deterministically
  useEffect(() => {
    if (!identification?.identifier || identification.layer !== "d2_social") return;
    (async () => {
      const hash = await persistViewer(campaignId, identification.identifier!);
      setViewerHash(hash);
      setProspectEmail(identification.identifier!.toLowerCase().trim());
    })();
  }, [identification, campaignId]);

  // Track block visibility (GC-11) — calls now succeed thanks to lite-events whitelist.
  useEffect(() => {
    if (!data) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-block-group]"));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.4) {
            const id = e.target.id;
            setViewedIds((prev) => {
              if (prev.has(id)) return prev;
              const next = new Set(prev);
              next.add(id);
              try {
                localStorage.setItem(
                  `ekko_dr_viewed_${campaignId}`,
                  JSON.stringify(Array.from(next))
                );
              } catch { /* ignore */ }
              void supabase.functions.invoke("track-document-events", {
                body: {
                  campaign_id: campaignId,
                  asset_id: e.target.getAttribute("data-asset-id"),
                  event_type: "block_viewed",
                  viewer_hash: viewerHash,
                  metadata: { block_id: id, block_group: e.target.getAttribute("data-block-group") },
                },
              }).catch(() => {});
              return next;
            });
          }
        });
      },
      { threshold: [0, 0.4, 0.8] }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [data, campaignId, viewerHash]);

  // Restore viewedIds
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`ekko_dr_viewed_${campaignId}`);
      if (raw) setViewedIds(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, [campaignId]);

  // Scroll velocity (GC-13) — throttled 2s.
  useEffect(() => {
    let ticking = false;
    let lastSent = 0;
    const onScroll = () => {
      const now = Date.now();
      const dy = window.scrollY - scrollVelocityRef.current.last;
      const dt = now - scrollVelocityRef.current.ts;
      scrollVelocityRef.current = { last: window.scrollY, ts: now };
      if (dt <= 0) return;
      const v = Math.abs(dy) / dt;
      if (now - lastSent < 2000 || v < 0.5) return;
      lastSent = now;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          void supabase.functions.invoke("track-document-events", {
            body: {
              campaign_id: campaignId,
              event_type: "scroll_velocity",
              viewer_hash: viewerHash,
              metadata: { velocity_px_per_ms: Number(v.toFixed(3)) },
            },
          }).catch(() => {});
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [campaignId, viewerHash]);

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

  const greetingFirstName = data.resolved_viewer?.name?.split(" ")[0] || null;

  const grouped: Partial<Record<BlockGroup, V15Asset[]>> = {};
  for (const a of data.secondary_assets || []) {
    const g = (a.block_group as BlockGroup | null) || "other";
    if (!BLOCK_ORDER.includes(g)) continue;
    if (g === "hero_video") continue;
    if (!grouped[g]) grouped[g] = [];
    grouped[g]!.push(a);
  }

  // Synthetic Calendly block when AE configured a calendly_url.
  if (data.calendly_url) {
    grouped.calendly = grouped.calendly || [];
  }

  const orderedBlocks = BLOCK_ORDER
    .filter((g) => g !== "hero_video" && (grouped[g] || g === "calendly" && data.calendly_url))
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

  const tocSections = orderedBlocks.map((b) => ({
    id: b.id, blockGroup: b.group, title: b.title,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <SoftIdentifyTriggers campaignId={campaignId} videoPlaybackSeconds={videoSeconds} />

      <SmartQuestionPopup
        campaignId={campaignId}
        videoPlaybackSeconds={videoSeconds}
        videoIsPaused={videoPaused}
        onSuggest={() => {
          if (!assistantOpen) {
            setAssistantPulse(true);
            setTimeout(() => setAssistantPulse(false), 6000);
          }
        }}
      />

      <PresenceIndicator
        campaignId={campaignId}
        viewerHash={viewerHash}
        prospectEmail={prospectEmail}
        selfLabel={data.resolved_viewer?.name || null}
      />
      <SharedCursors campaignId={campaignId} viewerHash={viewerHash} />

      <div className="sticky top-0 z-20 border-b border-foreground/5 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1100px] items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[hsl(var(--accent))] text-[10px] font-bold text-foreground">
              e
            </div>
            <span className="text-[12px] font-medium tracking-tight text-foreground/65">
              Ekko {data.company_display_name ? `· Espace ${data.company_display_name}` : ""}
            </span>
          </div>
        </div>
      </div>

      <HeroSection
        payload={data}
        greetingFirstName={greetingFirstName}
        videoSeconds={videoSeconds}
        onPlaybackSeconds={setVideoSeconds}
        onVideoStateChange={(playing) => setVideoPaused(!playing)}
        totalBlocks={orderedBlocks.length}
        viewedCount={orderedBlocks.filter((b) => viewedIds.has(b.id)).length}
      />

      {!data.resolved_viewer && !identification && (
        <section className="mx-auto max-w-[1100px] px-6 py-8">
          <DealRoomIdentification
            knownViewerName={null}
            topicsAvailable={data.topics_enabled || []}
            onIdentify={setIdentification}
          />
        </section>
      )}

      <div id="deal-room-blocks" className="mx-auto flex max-w-[1100px] gap-12 px-6 py-4">
        <StickyTOC sections={tocSections} viewedIds={viewedIds} />
        <main className="min-w-0 flex-1">
          {orderedBlocks.map((b, i) => {
            const Comp = BLOCK_COMPONENTS[b.group];
            const viewedAt = viewedIds.has(b.id) ? "vu" : null;
            return (
              <BlockShell
                key={b.id}
                id={b.id}
                blockGroup={b.group}
                index={i}
                total={orderedBlocks.length}
                title={b.title}
                subtitle={b.subtitle}
                viewedAt={viewedAt}
                campaignId={campaignId}
                orgId={orgId}
                viewerHash={viewerHash}
                prospectEmail={prospectEmail}
              >
                {b.group === "calendly" ? (
                  <CalendlyBlock
                    url={data.calendly_url || null}
                    aeFirstName={data.ae_name?.split(" ")[0] || null}
                  />
                ) : (
                  <Comp
                    campaignId={campaignId}
                    assets={b.assets}
                    viewerHash={viewerHash}
                    prospectEmail={prospectEmail}
                    blockGroup={b.group}
                    blockIndex={i}
                    totalBlocks={orderedBlocks.length}
                  />
                )}
              </BlockShell>
            );
          })}

          <section className="border-b border-foreground/5 py-12">
            <ForwardMagnetForm campaignId={campaignId} />
          </section>
        </main>
      </div>

      <TrustBanner aeName={data.ae_name} />
      <MobileTOC sections={tocSections} viewedIds={viewedIds} />

      <AssistantDrawer
        campaignId={campaignId}
        aeFirstName={data.ae_name?.split(" ")[0] || null}
        viewerHash={viewerHash}
        prospectEmail={prospectEmail}
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        pulse={assistantPulse}
      />

      <div className="h-20 lg:hidden" />
    </div>
  );
}
