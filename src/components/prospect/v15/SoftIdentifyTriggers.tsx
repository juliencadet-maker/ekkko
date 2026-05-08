import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type TriggerType =
  | "video_60s"
  | "pdf_download"
  | "emoji_reaction"
  | "second_visit"
  | "before_unload";

interface Props {
  campaignId: string;
  /** Cumulative video playback in seconds, fed by the parent video player. */
  videoPlaybackSeconds: number;
}

/**
 * Phase 1d — Soft identify hooks (5 triggers).
 *  T1 : 60s vidéo cumulés
 *  T2 : click "Télécharger PDF"
 *  T3 : réaction emoji
 *  T4 : 2e visite (localStorage)
 *  T5 : beforeunload après 30s+
 *
 * Cooldown : géré côté edge `prospect-feedback` (10s).
 * Composant headless — ne rend rien.
 */
export function SoftIdentifyTriggers({ campaignId, videoPlaybackSeconds }: Props) {
  const fired = useRef<Set<TriggerType>>(new Set());
  const mountedAt = useRef<number>(Date.now());

  const fire = async (type: TriggerType) => {
    if (fired.current.has(type)) return;
    fired.current.add(type);
    try {
      await supabase.functions.invoke("prospect-feedback", {
        body: {
          campaign_id: campaignId,
          event_type: "soft_identify_trigger",
          metadata: { trigger: type },
        },
      });
    } catch (e) {
      // silencieux côté prospect — pas de log visible.
    }
  };

  // T1 — 60s vidéo cumulés
  useEffect(() => {
    if (videoPlaybackSeconds >= 60) fire("video_60s");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoPlaybackSeconds]);

  // T4 — 2e visite (localStorage par token campaign)
  useEffect(() => {
    const key = `ekko_visit_count_${campaignId}`;
    const prev = parseInt(localStorage.getItem(key) || "0", 10);
    const next = prev + 1;
    localStorage.setItem(key, String(next));
    if (next >= 2) fire("second_visit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // T5 — beforeunload après 30s+
  useEffect(() => {
    const handler = () => {
      const elapsed = (Date.now() - mountedAt.current) / 1000;
      if (elapsed >= 30) {
        // sendBeacon pour fiabilité au unload
        try {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prospect-feedback`;
          navigator.sendBeacon(
            url,
            new Blob(
              [
                JSON.stringify({
                  campaign_id: campaignId,
                  event_type: "soft_identify_trigger",
                  metadata: { trigger: "before_unload", elapsed_sec: Math.round(elapsed) },
                }),
              ],
              { type: "application/json" }
            )
          );
        } catch (e) {
          // ignore
        }
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [campaignId]);

  return null;
}

/** Helpers explicites pour T2/T3 — appelés par les composants enfants. */
export function useSoftTriggerFire(campaignId: string) {
  return async (type: "pdf_download" | "emoji_reaction") => {
    try {
      await supabase.functions.invoke("prospect-feedback", {
        body: {
          campaign_id: campaignId,
          event_type: "soft_identify_trigger",
          metadata: { trigger: type },
        },
      });
    } catch {
      // silencieux
    }
  };
}
