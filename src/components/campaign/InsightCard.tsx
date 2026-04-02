import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

type InsightType = "fact" | "inference" | "declared";

interface InsightCardProps {
  type: InsightType;
  title: string;
  body: string;
  defaultExpanded?: boolean;
}

const TYPE_CONFIG: Record<InsightType, { label: string; className: string }> = {
  fact: { label: "FAIT", className: "bg-[hsl(var(--info))]/10 text-[hsl(var(--info))] border-[hsl(var(--info))]/30" },
  inference: { label: "INFÉRENCE ≈", className: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30" },
  declared: { label: "CONTEXTE AE", className: "bg-primary/10 text-primary border-primary/30" },
};

export function InsightCard({ type, title, body, defaultExpanded = false }: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const config = TYPE_CONFIG[type];

  return (
    <div
      className="rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-2">
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <Badge variant="outline" className={`text-[10px] ${config.className}`}>
          {config.label}
        </Badge>
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      {isExpanded && (
        <p className="text-sm text-muted-foreground mt-2 ml-6">{body}</p>
      )}
    </div>
  );
}
