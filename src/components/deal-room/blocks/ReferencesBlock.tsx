import { ExternalLink } from "lucide-react";
import { BlockProps } from "../types";

export function ReferencesBlock({ assets }: BlockProps) {
  if (!assets.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {assets.map((a) => (
        <a
          key={a.id}
          href={a.file_url || "#"}
          target={a.file_url ? "_blank" : undefined}
          rel="noreferrer"
          className="group flex items-start gap-4 rounded-xl border border-foreground/8 bg-card p-5 transition-all hover:border-foreground/20 hover:shadow-md"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-foreground">
              {a.block_title || "Référence client"}
            </p>
            {a.block_description && (
              <p className="mt-1 text-[13px] leading-relaxed text-foreground/60">
                {a.block_description}
              </p>
            )}
          </div>
          {a.file_url && (
            <ExternalLink className="h-4 w-4 shrink-0 text-foreground/40 transition-colors group-hover:text-foreground" />
          )}
        </a>
      ))}
    </div>
  );
}
