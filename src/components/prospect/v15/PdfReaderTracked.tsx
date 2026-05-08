import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSoftTriggerFire } from "./SoftIdentifyTriggers";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Props {
  campaignId: string;
  assetId: string;
  /** Public URL of the PDF asset (signed if private). */
  pdfUrl: string;
  fileName?: string;
}

/**
 * Phase 1d — PdfReaderTracked.
 * Lightweight wrapper: native browser PDF viewer (iframe) + click-to-download trigger.
 * Emits document tracking events (page_number / scroll_pct via postMessage when available).
 *
 * Note : la lib pdfjs n'est pas embarquée pour respecter le budget JS <200kb gzip.
 * Le tracking page-level est délégué à `track-document-events` côté serveur,
 * alimenté par le viewer natif via heartbeat (estimation conservative).
 */
export function PdfReaderTracked({ campaignId, assetId, pdfUrl, fileName }: Props) {
  const [openedAt] = useState(() => Date.now());
  const heartbeatRef = useRef<number | null>(null);
  const fireSoft = useSoftTriggerFire(campaignId);

  // Heartbeat : envoie un ping toutes les 15s tant que la page reste active.
  useEffect(() => {
    const send = async (eventType: string, payload: Record<string, unknown> = {}) => {
      try {
        await supabase.functions.invoke("track-document-events", {
          body: {
            campaign_id: campaignId,
            asset_id: assetId,
            event_type: eventType,
            time_spent_seconds: Math.round((Date.now() - openedAt) / 1000),
            ...payload,
          },
        });
      } catch {
        // silencieux
      }
    };

    void send("document_opened");

    heartbeatRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void send("document_heartbeat");
      }
    }, 15000);

    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      void send("document_closed");
    };
  }, [campaignId, assetId, openedAt]);

  const handleDownload = () => {
    void fireSoft("pdf_download");
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = fileName || "document.pdf";
    a.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground truncate">{fileName || "Document"}</p>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1.5" />
          Télécharger
        </Button>
      </div>
      <div className="aspect-[4/5] w-full rounded-lg overflow-hidden border border-border bg-muted">
        <iframe
          src={pdfUrl}
          title={fileName || "Document"}
          className="w-full h-full"
          loading="lazy"
        />
      </div>
    </div>
  );
}
