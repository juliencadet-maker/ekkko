import { FileText, ExternalLink, Image as ImageIcon } from "lucide-react";
import { BlockProps } from "../types";

export function OtherBlock({ assets }: BlockProps) {
  if (!assets.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-foreground/8 bg-card">
      {assets.map((a, i) => {
        const Icon = a.asset_type === "image" ? ImageIcon : a.asset_type === "link" ? ExternalLink : FileText;
        return (
          <a
            key={a.id}
            href={a.file_url || "#"}
            target={a.file_url ? "_blank" : undefined}
            rel="noreferrer"
            className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-foreground/[0.03] ${
              i > 0 ? "border-t border-foreground/8" : ""
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/[0.05]">
              <Icon className="h-4 w-4 text-foreground/60" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-foreground">
                {a.block_title || a.label_fr || "Élément"}
              </p>
              {a.block_description && (
                <p className="truncate text-[12px] text-foreground/50">{a.block_description}</p>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}
