import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  campaignId: string;
  orgId?: string | null;
  assetId?: string | null;
  blockGroup: string;
  viewerHash: string | null;
  prospectEmail: string | null;
}

const OPTS = [
  { key: "up", emoji: "👍", label: "Pertinent" },
  { key: "think", emoji: "🤔", label: "À discuter" },
  { key: "spark", emoji: "⚡", label: "Wow" },
] as const;

const LS_KEY = (campaignId: string, scope: string) =>
  `ekko_reactions_${campaignId}_${scope}`;

export function Reactions({ campaignId, assetId, blockGroup, viewerHash, prospectEmail }: Props) {
  const scope = assetId || blockGroup;
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    try {
      setActive(localStorage.getItem(LS_KEY(campaignId, scope)));
    } catch {
      /* ignore */
    }
  }, [campaignId, scope]);

  const toggle = async (key: string) => {
    const next = active === key ? null : key;
    const prev = active;
    setActive(next);
    try {
      if (next) localStorage.setItem(LS_KEY(campaignId, scope), next);
      else localStorage.removeItem(LS_KEY(campaignId, scope));
    } catch { /* ignore */ }

    // D82 fix C — server-side org_id resolution via edge fn.
    try {
      if (prev && prev !== next) {
        await supabase.functions.invoke("submit-prospect-reaction", {
          body: {
            action: "remove",
            campaign_id: campaignId,
            asset_id: assetId ?? null,
            block_group: blockGroup,
            reaction: prev,
            viewer_hash: viewerHash,
            prospect_email: prospectEmail,
          },
        });
      }
      if (next) {
        await supabase.functions.invoke("submit-prospect-reaction", {
          body: {
            action: "add",
            campaign_id: campaignId,
            asset_id: assetId ?? null,
            block_group: blockGroup,
            reaction: next,
            viewer_hash: viewerHash,
            prospect_email: prospectEmail,
          },
        });
      }
    } catch {
      /* silent — reactions are best-effort */
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {OPTS.map((o) => {
        const on = active === o.key;
        return (
          <button
            key={o.key}
            onClick={() => toggle(o.key)}
            className={[
              "group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
              on
                ? "border-foreground/20 bg-foreground/[0.04] text-foreground"
                : "border-foreground/10 bg-transparent text-foreground/55 hover:border-foreground/20 hover:bg-foreground/[0.03] hover:text-foreground/80",
            ].join(" ")}
            aria-label={o.label}
          >
            <span className="text-[13px] leading-none">{o.emoji}</span>
            <span className="hidden text-[11px] font-medium tracking-tight sm:inline">
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
