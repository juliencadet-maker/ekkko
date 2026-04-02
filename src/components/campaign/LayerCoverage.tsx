import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface LayerRow {
  layer: string;
  current: number;
  estimated: number;
}

interface LayerCoverageProps {
  layers: LayerRow[];
}

export function LayerCoverage({ layers }: LayerCoverageProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {layers.map((l) => {
        const ok = l.current >= Math.ceil(l.estimated * 0.5);
        return (
          <div
            key={l.layer}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border ${
              ok ? "border-accent/30 text-accent" : "border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))]"
            }`}
          >
            <span className="font-medium">{l.layer}</span>
            <span>{l.current}/~{l.estimated}</span>
            {ok ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}
