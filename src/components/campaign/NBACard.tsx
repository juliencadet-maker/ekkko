import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RiskLevel = "high_risk" | "watch" | "healthy" | string;

interface NBACardProps {
  actionLine: string;
  whyLine: string;
  confidenceLabel: string;
  ctaLabel?: string;
  riskLevel?: RiskLevel;
  onCtaClick?: () => void;
  onMarkDone?: () => void;
  /** Optional extra actions: e.g. "Envoyer un contenu", "Ajouter un contact" */
  secondaryAction?: { label: string; onClick: () => void };
}

const riskStyles: Record<string, { bg: string; border: string }> = {
  high_risk: { bg: "bg-[#FCEBEB]", border: "border-l-[3px] border-l-[#E24B4A]" },
  watch: { bg: "bg-[#FAEEDA]", border: "border-l-[3px] border-l-[#E8A838]" },
  healthy: { bg: "bg-[#D0FAE8]", border: "border-l-[3px] border-l-[#1AE08A]" },
};

export function NBACard({ actionLine, whyLine, confidenceLabel, riskLevel, onMarkDone, secondaryAction }: NBACardProps) {
  const [dismissed, setDismissed] = useState(false);
  const risk = riskLevel && riskStyles[riskLevel] ? riskLevel : "healthy";
  const style = riskStyles[risk];

  if (dismissed) return null;

  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", style.bg, style.border)}>
      {/* Label */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Action recommandée
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-muted-foreground/50 cursor-default">ⓘ</span>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs">{confidenceLabel}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Action line — bold, prominent */}
      <div className="px-4 py-2">
        <p className="text-base font-bold text-foreground leading-snug">{actionLine}</p>
      </div>

      {/* Why line — factual, one line */}
      <div className="px-4 pb-2">
        <p className="text-sm text-muted-foreground leading-snug">{whyLine}</p>
      </div>

      {/* CTAs */}
      <div className="px-4 py-3 flex items-center justify-end gap-2 flex-wrap">
        {secondaryAction && (
          <Button
            size="sm"
            variant="outline"
            className="text-sm"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="text-sm border-[#0D1B2A] text-[#0D1B2A] hover:bg-[#0D1B2A]/5"
          onClick={() => setDismissed(true)}
        >
          Pas maintenant
        </Button>
        <Button
          size="lg"
          className="rounded-cta bg-accent text-accent-foreground hover:bg-accent/90 text-base font-semibold px-6"
          onClick={onMarkDone}
        >
          Je l'ai fait
        </Button>
      </div>
    </div>
  );
}
