import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Users } from "lucide-react";

interface Props {
  campaignId: string;
  viewerHash: string | null;
  prospectEmail: string | null;
  selfLabel?: string | null;
}

interface Presence {
  hash: string;
  label: string;
  joined_at: number;
}

/**
 * Phase 1d.5g — GC-15 Realtime presence.
 * Lightweight viewer indicator: shows live concurrent viewers in this Deal Room.
 * Uses Supabase Realtime presence channel (no DB write, ephemeral).
 */
export function PresenceIndicator({ campaignId, viewerHash, prospectEmail, selfLabel }: Props) {
  const [count, setCount] = useState(1);
  const [others, setOthers] = useState<string[]>([]);

  useEffect(() => {
    if (!campaignId) return;
    const myHash = viewerHash || `anon_${Math.random().toString(36).slice(2, 10)}`;
    const myLabel = selfLabel || (prospectEmail ? prospectEmail.split("@")[0] : "Visiteur");

    const channel = supabase.channel(`dr_presence:${campaignId}`, {
      config: { presence: { key: myHash } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Presence[]>;
        const total = Object.keys(state).length;
        setCount(total);
        const labels: string[] = [];
        for (const [k, arr] of Object.entries(state)) {
          if (k === myHash) continue;
          if (arr[0]?.label) labels.push(arr[0].label);
        }
        setOthers(labels);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            hash: myHash,
            label: myLabel,
            joined_at: Date.now(),
          } satisfies Presence);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [campaignId, viewerHash, prospectEmail, selfLabel]);

  if (count <= 1) return null;

  return (
    <div className="fixed bottom-6 left-6 z-30 hidden items-center gap-2 rounded-full border border-foreground/10 bg-background/90 px-3 py-1.5 shadow-md backdrop-blur lg:flex">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--accent))] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />
      </span>
      <Users className="h-3.5 w-3.5 text-foreground/55" />
      <span className="text-[12px] font-medium text-foreground/75">
        {count} personne{count > 1 ? "s" : ""} sur cet espace
      </span>
      {others.length > 0 && (
        <span className="hidden text-[11px] text-foreground/45 xl:inline">
          · avec {others.slice(0, 2).join(", ")}{others.length > 2 ? "…" : ""}
        </span>
      )}
    </div>
  );
}
