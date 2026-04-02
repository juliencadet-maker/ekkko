import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NBACardProps {
  factLine: string;
  contextLine: string;
  confidenceLabel: string;
  ctaLabel: string;
  onCtaClick?: () => void;
}

export function NBACard({ factLine, contextLine, confidenceLabel, ctaLabel, onCtaClick }: NBACardProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Label */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Action prioritaire
        </span>
      </div>

      {/* Fact line */}
      <div className="px-4 py-2.5 bg-muted/50">
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
          size="sm"
          className="rounded-cta bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={onCtaClick}
        >
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
