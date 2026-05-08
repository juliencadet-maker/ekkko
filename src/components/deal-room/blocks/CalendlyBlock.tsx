import { useEffect } from "react";
import { Calendar, ExternalLink } from "lucide-react";

interface Props {
  url: string | null;
  aeFirstName?: string | null;
}

/**
 * Phase 1d.5g — Calendly inline block.
 * Loads Calendly widget script once. Falls back to plain CTA if blocked.
 */
export function CalendlyBlock({ url, aeFirstName }: Props) {
  useEffect(() => {
    if (!url) return;
    if (document.getElementById("ekko-calendly-script")) return;
    const s = document.createElement("script");
    s.id = "ekko-calendly-script";
    s.src = "https://assets.calendly.com/assets/external/widget.js";
    s.async = true;
    document.body.appendChild(s);
  }, [url]);

  if (!url) {
    return (
      <div className="rounded-xl border border-foreground/8 bg-card p-6 text-[13px] text-foreground/55">
        Aucun créneau ouvert pour l'instant.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-foreground/8 bg-card">
      <div className="flex items-center justify-between border-b border-foreground/5 px-5 py-3">
        <div className="flex items-center gap-2 text-[13px] text-foreground/75">
          <Calendar className="h-4 w-4 text-foreground/55" />
          <span className="font-medium">
            Réserver un échange{aeFirstName ? ` avec ${aeFirstName}` : ""}
          </span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-foreground/55 hover:text-foreground"
        >
          Ouvrir <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div
        className="calendly-inline-widget"
        data-url={url}
        style={{ minWidth: "320px", height: "640px" }}
      />
    </div>
  );
}
