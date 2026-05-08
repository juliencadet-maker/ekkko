import { useEffect, useRef } from "react";

/**
 * SmartQuestionPopup — opens AssistantDrawer based on intelligent triggers (OOB-4):
 *  T1: 30s visible on ROI block without scrolling
 *  T2: second visit (localStorage)
 *  T3: video paused > 8s
 *  T4: hover download CTA > 5s
 *
 * This is a headless component that calls onSuggest() once per session.
 */
interface Props {
  campaignId: string;
  videoPlaybackSeconds: number;
  videoIsPaused: boolean;
  onSuggest: () => void;
}

export function SmartQuestionPopup({
  campaignId,
  videoPlaybackSeconds,
  videoIsPaused,
  onSuggest,
}: Props) {
  const fired = useRef(false);
  const startedAt = useRef(Date.now());

  const trigger = () => {
    if (fired.current) return;
    fired.current = true;
    onSuggest();
  };

  // T2 — second visit
  useEffect(() => {
    try {
      const k = `ekko_visit_count_${campaignId}`;
      const prev = parseInt(localStorage.getItem(k) || "0", 10);
      if (prev >= 1) {
        // NB: SoftIdentifyTriggers already increments, so prev=1 means this is at least 2nd
        const tid = setTimeout(trigger, 4000);
        return () => clearTimeout(tid);
      }
    } catch {
      /* ignore */
    }
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  // T1 — 30s on ROI section visible
  useEffect(() => {
    const roi = document.getElementById("block-roi");
    if (!roi) return;
    let visibleSince: number | null = null;
    let raf: number | null = null;

    const check = () => {
      raf = window.setTimeout(() => {
        if (visibleSince && Date.now() - visibleSince >= 30000) trigger();
        else if (visibleSince) check();
      }, 1000) as unknown as number;
    };

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.4) {
            if (!visibleSince) {
              visibleSince = Date.now();
              check();
            }
          } else {
            visibleSince = null;
            if (raf) clearTimeout(raf);
          }
        }
      },
      { threshold: [0, 0.4, 0.8] }
    );
    obs.observe(roi);
    return () => {
      obs.disconnect();
      if (raf) clearTimeout(raf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // T3 — video paused > 8s after some playback
  useEffect(() => {
    if (!videoIsPaused || videoPlaybackSeconds < 10) return;
    const tid = setTimeout(trigger, 8000);
    return () => clearTimeout(tid);
  }, [videoIsPaused, videoPlaybackSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // T4 — hover any [data-download-cta] for 5s
  useEffect(() => {
    let timer: number | null = null;
    const onEnter = () => {
      timer = window.setTimeout(trigger, 5000);
    };
    const onLeave = () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
    };
    const els = document.querySelectorAll("[data-download-cta]");
    els.forEach((el) => {
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
    });
    return () => {
      els.forEach((el) => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
      });
      if (timer) window.clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Floor: keep startedAt referenced to silence lint
  void startedAt;
  return null;
}
