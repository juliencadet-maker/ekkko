import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RiskLevel = "high_risk" | "watch" | "healthy" | string;

interface NBACardProps {
  actionLine: string;
  whyLine: string;
  confidenceLabel: string;
  ctaLabel: string;
  riskLevel?: RiskLevel;
  onCtaClick?: () => void;
}

const riskStyles: Record<string, { bg: string; border: string }> = {
  high_risk: { bg: "bg-[#FCEBEB]", border: "border-l-[3px] border-l-[#E24B4A]" },
  watch: { bg: "bg-[#FAEEDA]", border: "border-l-[3px] border-l-[#E8A838]" },
  healthy: { bg: "bg-[#D0FAE8]", border: "border-l-[3px] border-l-[#1AE08A]" },
};

export function NBACard({ actionLine, whyLine, confidenceLabel, ctaLabel, riskLevel, onCtaClick }: NBACardProps) {
  const risk = riskLevel && riskStyles[riskLevel] ? riskLevel : "healthy";
  const style = riskStyles[risk];

  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", style.bg, style.border)}>
      {/* Label */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Action prioritaire
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

      {/* CTA */}
      <div className="px-4 py-3 flex justify-end">
        <Button
          size="lg"
          className="rounded-cta bg-accent text-accent-foreground hover:bg-accent/90 text-base font-semibold px-6"
          onClick={onCtaClick}
        >
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
