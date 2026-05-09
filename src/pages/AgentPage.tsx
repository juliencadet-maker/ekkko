import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgentSurface } from "@/components/agent/AgentSurface";
import { PendingActionsList } from "@/components/agent/PendingActionsList";
import { MessageSquare } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface CampaignOption { id: string; name: string }

export default function AgentPage() {
  const { user, membership } = useAuthContext();
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [viewers, setViewers] = useState<any[]>([]);
  const [dealScore, setDealScore] = useState<any>(null);

  useEffect(() => {
    if (!membership?.org_id) return;
    supabase
      .from("campaigns")
      .select("id, name")
      .eq("org_id", membership.org_id)
      .not("status", "in", '("completed","cancelled")')
      .order("created_at", { ascending: false })
      .then(({ data }) => setCampaigns(data ?? []));
  }, [membership?.org_id]);

  useEffect(() => {
    if (!selectedId) { setViewers([]); setDealScore(null); return; }
    (async () => {
      const [scoreRes, viewersRes] = await Promise.all([
        supabase.from("deal_scores").select("*").eq("campaign_id", selectedId).order("scored_at", { ascending: false }).limit(1),
        supabase.from("viewers").select("*").eq("campaign_id", selectedId).order("contact_score", { ascending: false, nullsFirst: false }),
      ]);
      setDealScore(scoreRes.data?.[0] ?? null);
      setViewers(viewersRes.data ?? []);
    })();
  }, [selectedId]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSelectedName(campaigns.find((c) => c.id === id)?.name ?? "");
  };

  return (
    <AppLayout>
      <PageHeader
        title="Agent Ekko"
        description="Posez vos questions, et validez les actions externes que l'agent suggère."
        actions={
          <Select value={selectedId ?? ""} onValueChange={handleSelect}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Choisir un deal" /></SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        }
      />

      {selectedId ? (
        <div className="h-[calc(100vh-12rem)]">
          <AgentSurface
            mode="full"
            campaignId={selectedId}
            campaignName={selectedName}
            viewers={viewers}
            dealScore={dealScore}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center border rounded-lg bg-card">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">Choisissez un deal pour discuter</p>
            <p className="text-sm text-muted-foreground">Vos actions en attente restent visibles à droite.</p>
          </div>
          <aside className="border rounded-lg bg-card p-4">
            <PendingActionsList userId={user?.id ?? null} />
          </aside>
        </div>
      )}
    </AppLayout>
  );
}
