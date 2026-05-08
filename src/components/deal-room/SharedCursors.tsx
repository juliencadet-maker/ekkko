import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  campaignId: string;
  viewerHash: string | null;
  enabled?: boolean;
}

interface CursorMsg {
  hash: string;
  label: string;
  x: number; // 0..1 viewport ratio
  y: number; // 0..1 viewport ratio
  color: string;
  ts: number;
}

const COLORS = [
  "#1AE08A", // signal
  "#F6B100",
  "#5B8DEF",
  "#E0506B",
  "#8B5CF6",
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

/**
 * Phase 1d.5g — OOB-9 shared cursors.
 * Broadcasts mouse position via Supabase Realtime (broadcast, not presence).
 * Throttled to ~50ms. Only renders other viewers' cursors. Auto-hide after 3s idle.
 */
export function SharedCursors({ campaignId, viewerHash, enabled = true }: Props) {
  const [others, setOthers] = useState<Record<string, CursorMsg>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);
  const myHashRef = useRef<string>(viewerHash || `anon_${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    myHashRef.current = viewerHash || myHashRef.current;
  }, [viewerHash]);

  useEffect(() => {
    if (!enabled || !campaignId) return;
    const channel = supabase.channel(`dr_cursor:${campaignId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "cursor" }, (payload) => {
        const m = payload.payload as CursorMsg;
        if (!m?.hash || m.hash === myHashRef.current) return;
        setOthers((prev) => ({ ...prev, [m.hash]: m }));
      })
      .subscribe();
    channelRef.current = channel;

    const onMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastSent.current < 50) return;
      lastSent.current = now;
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      void channel.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          hash: myHashRef.current,
          label: "",
          x, y,
          color: pickColor(myHashRef.current),
          ts: now,
        } satisfies CursorMsg,
      });
    };

    window.addEventListener("mousemove", onMove);

    // Cleanup stale cursors every 1.5s.
    const interval = window.setInterval(() => {
      const now = Date.now();
      setOthers((prev) => {
        const next: Record<string, CursorMsg> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.ts < 3000) next[k] = v;
        }
        return next;
      });
    }, 1500);

    return () => {
      window.removeEventListener("mousemove", onMove);
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [campaignId, enabled]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 hidden lg:block" aria-hidden>
      {Object.values(others).map((c) => (
        <div
          key={c.hash}
          className="absolute -translate-x-1 -translate-y-1 transition-[left,top] duration-75 ease-out"
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M2 2 L2 14 L6 11 L8.5 16 L11 15 L8.5 10 L14 10 Z"
              fill={c.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}
