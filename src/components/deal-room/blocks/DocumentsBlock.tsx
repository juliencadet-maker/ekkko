import { FileText, ChevronRight } from "lucide-react";
import { BlockProps } from "../types";
import { PdfReaderTracked } from "@/components/prospect/v15/PdfReaderTracked";
import { useState } from "react";

export function DocumentsBlock({ assets, campaignId }: BlockProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (!assets.length) return null;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-foreground/8 bg-card">
        {assets.map((a, i) => {
          const isPdf = a.asset_type === "pdf" || (a.file_url || "").toLowerCase().endsWith(".pdf");
          const expanded = expandedId === a.id;
          return (
            <div key={a.id} className={i > 0 ? "border-t border-foreground/8" : ""}>
              <button
                onClick={() =>
                  isPdf ? setExpandedId(expanded ? null : a.id) : window.open(a.file_url || "", "_blank")
                }
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-foreground/[0.03]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/[0.05]">
                  <FileText className="h-4 w-4 text-foreground/60" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-foreground">
                    {a.block_title || a.label_fr || "Document"}
                  </p>
                  {a.block_description && (
                    <p className="truncate text-[12px] text-foreground/50">{a.block_description}</p>
                  )}
                </div>
                <ChevronRight
                  className={`h-4 w-4 text-foreground/35 transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </button>
              {expanded && isPdf && a.file_url && (
                <div className="border-t border-foreground/8 bg-background/50 p-4">
                  <PdfReaderTracked
                    campaignId={campaignId}
                    assetId={a.id}
                    pdfUrl={a.file_url}
                    fileName={a.block_title || "Document"}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
