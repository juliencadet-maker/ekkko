import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RiskLevel = "high_risk" | "watch" | "healthy" | string;

interface NBACardProps {
  factLine: string;
  contextLine: string;
  confidenceLabel: string;
  ctaLabel: string;
  riskLevel?: RiskLevel;
  onCtaClick?: () => void;
}

const riskStyles: Record<string, { bg: string; border: string }> = {
  high_risk: { bg: "bg-[#FCEBEB]", border: "border-l-[3px] border-l-[#E24B4A]" },
  watch: { bg: "bg-[#FAEEDA]", border: "border-l-[3px] border-l-[#E8A838]" },
  healthy: { bg: "bg-[#D0FAE8]", border: "border-l-[3px] border-l-accent" },
};

export function NBACard({ factLine, contextLine, confidenceLabel, ctaLabel, riskLevel, onCtaClick }: NBACardProps) {
  const risk = riskLevel && riskStyles[riskLevel] ? riskLevel : "healthy";
  const style = riskStyles[risk];

  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", style.bg, style.border)}>
      {/* Label */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Action prioritaire
        </span>
      </div>

      {/* Fact line */}
      <div className="px-4 py-2.5">
        <p className="text-sm text-foreground">{factLine}</p>
      </div>

      {/* Context AE line */}
      <div className="px-4 py-2.5 bg-[hsl(var(--warning))]/10">
        <p className="text-sm italic text-[hsl(var(--warning))]">{contextLine}</p>
      </div>

      {/* Footer: confidence + CTA */}
      <div className="px-4 py-3 flex items-center justify-between">
        <Badge variant="outline" className="text-xs border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))]">
          {confidenceLabel}
        </Badge>
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
