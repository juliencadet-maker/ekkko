import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { EkkoAgent } from "@/components/campaign/EkkoAgent";
import { MessageSquare } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CampaignOption {
  id: string;
  name: string;
}

export default function AgentPage() {
  const { membership } = useAuthContext();
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [viewers, setViewers] = useState<any[]>([]);
  const [dealScore, setDealScore] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load active campaigns
  useEffect(() => {
    if (!membership?.org_id) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("org_id", membership.org_id)
        .not("status", "in", '("completed","cancelled")')
        .order("created_at", { ascending: false });
      setCampaigns(data || []);
      setIsLoading(false);
    };
    fetch();
  }, [membership?.org_id]);

  // Load deal data when campaign selected
  useEffect(() => {
    if (!selectedId) { setViewers([]); setDealScore(null); return; }
    const fetchDeal = async () => {
      const [scoreRes, viewersRes] = await Promise.all([
        supabase.from("deal_scores").select("*").eq("campaign_id", selectedId).order("scored_at", { ascending: false }).limit(1),
        supabase.from("viewers").select("*").eq("campaign_id", selectedId).order("contact_score", { ascending: false, nullsFirst: false }),
      ]);
      setDealScore(scoreRes.data?.[0] || null);
      setViewers(viewersRes.data || []);
    };
    fetchDeal();
  }, [selectedId]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const c = campaigns.find((c) => c.id === id);
    setSelectedName(c?.name || "");
  };

  return (
    <AppLayout>
      <PageHeader
        title="Agent Ekko"
        description="Posez vos questions sur n'importe quel deal. L'agent a accès à tous les signaux."
        actions={
          <Select value={selectedId || ""} onValueChange={handleSelect}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Analyser quel deal ?" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {selectedId ? (
        <div className="h-[calc(100vh-12rem)]">
          <EkkoAgent
            campaignId={selectedId}
            campaignName={selectedName}
            viewers={viewers}
            dealScore={dealScore}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">Choisissez un deal pour commencer l'analyse</p>
          <p className="text-sm text-muted-foreground">Commencez par le deal avec le plus d'alertes actives</p>
        </div>
      )}
    </AppLayout>
  );
}
