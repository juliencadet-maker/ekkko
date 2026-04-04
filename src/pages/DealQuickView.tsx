import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EkkoLoader } from "@/components/ui/EkkoLoader";

export default function DealQuickView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    dealName: string;
    signal: string | null;
    risk: string | null;
    cta: string | null;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [campaignRes, scoreRes] = await Promise.all([
        supabase.from("campaigns").select("name").eq("id", id).single(),
        supabase
          .from("deal_scores")
          .select("alerts, recommended_action")
          .eq("campaign_id", id)
          .order("scored_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const campaign = campaignRes.data;
      const score = scoreRes.data;
      const alerts = (score?.alerts as any[]) || [];
      const firstAlert = alerts[0] ?? null;
      const action = score?.recommended_action as any;

      setData({
        dealName: campaign?.name || "Deal",
        signal: firstAlert?.signal_label || firstAlert?.text || null,
        risk: firstAlert?.contradiction_label || null,
        cta: action?.action_label || action?.label || null,
      });
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <EkkoLoader mode="loop" size={28} />
      </div>
    );
  }

  if (!data || (!data.signal && !data.cta)) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background px-4 py-6 max-w-lg mx-auto">
        <button
          onClick={() => navigate(`/app/campaigns/${id}`)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au deal
        </button>
        <p className="text-sm text-muted-foreground mt-8 text-center">
          Aucun signal disponible pour ce deal.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background px-4 py-6 max-w-lg mx-auto">
      <button
        onClick={() => navigate(`/app/campaigns/${id}`)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour au deal
      </button>

      <h1 className="text-xl font-bold text-foreground mb-6">{data.dealName}</h1>

      {data.signal && (
        <div className="rounded-lg border border-border p-4 bg-muted/50 mb-4">
          <Badge variant="outline" className="text-[10px] mb-2 bg-[hsl(var(--info))]/10 text-[hsl(var(--info))] border-[hsl(var(--info))]/30">
            FAIT
          </Badge>
          <p className="text-sm text-foreground">{data.signal}</p>
        </div>
      )}

      {data.risk && (
        <div className="rounded-lg border border-destructive/20 p-4 bg-destructive/5 mb-6">
          <Badge variant="outline" className="text-[10px] mb-2 border-destructive/30 text-destructive">
            CONTRADICTION
          </Badge>
          <p className="text-sm text-foreground">{data.risk}</p>
        </div>
      )}

      {data.cta && (
        <Button
          className="w-full rounded-cta bg-accent text-accent-foreground hover:bg-accent/90 mt-auto"
          size="lg"
          onClick={() => navigate(`/app/campaigns/${id}`)}
        >
          {data.cta}
        </Button>
      )}
    </div>
  );
}
