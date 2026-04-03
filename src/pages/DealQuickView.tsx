import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

// Mock data — will be replaced by real data
const MOCK = {
  dealName: "Schneider Electric — Expansion IoT",
  signal: {
    type: "fact" as const,
    text: "Pierre Blanc · 0 ouverture pricing · 12j",
  },
  risk: {
    text: "Pricing ignoré en stade négociation",
  },
  cta: "Relancer Pierre Blanc",
};

export default function DealQuickView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background px-4 py-6 max-w-lg mx-auto">
      <button
        onClick={() => navigate(`/app/campaigns/${id}`)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour au deal
      </button>

      <h1 className="text-xl font-bold text-foreground mb-6">{MOCK.dealName}</h1>

      {/* Signal (fait) */}
      <div className="rounded-lg border border-border p-4 bg-muted/50 mb-4">
        <Badge variant="outline" className="text-[10px] mb-2 bg-[hsl(var(--info))]/10 text-[hsl(var(--info))] border-[hsl(var(--info))]/30">
          FAIT
        </Badge>
        <p className="text-sm text-foreground">{MOCK.signal.text}</p>
      </div>

      {/* Risque (contradiction) */}
      <div className="rounded-lg border border-destructive/20 p-4 bg-destructive/5 mb-6">
        <Badge variant="outline" className="text-[10px] mb-2 border-destructive/30 text-destructive">
          CONTRADICTION
        </Badge>
        <p className="text-sm text-foreground">{MOCK.risk.text}</p>
      </div>

      {/* CTA */}
      <Button
        className="w-full rounded-cta bg-accent text-accent-foreground hover:bg-accent/90 mt-auto"
        size="lg"
        onClick={() => navigate(`/app/campaigns/${id}`)}
      >
        {MOCK.cta}
      </Button>
    </div>
  );
}