// Phase 1d.5d-1 — "Contenu du deal" tab orchestrator.
// Liste assets ordonnée + reorder (↑↓) + edit/delete + Drawer "Ajouter" 4 sources.
// Section "Questions du prospect" backlog.
// Lève D67 #1+#2 : permet la création d'asset après création du deal.

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AssetRow, type DealAssetRow } from "./AssetRow";
import { AddAssetSheet } from "./AddAssetSheet";
import { ProspectQuestionsSection } from "./ProspectQuestionsSection";

interface Props {
  campaignId: string;
  orgId: string;
  companyName: string;
}

const MAX_ACTIVE = 12;

export function DealContentTab({ campaignId, orgId, companyName }: Props) {
  const [assets, setAssets] = useState<DealAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("deal_assets")
      .select("id, asset_type, asset_purpose, file_url, display_order, block_group, block_title, block_description")
      .eq("campaign_id", campaignId)
      .eq("asset_status", "active")
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Échec du chargement des contenus");
      setLoading(false); return;
    }
    setAssets((data ?? []) as DealAssetRow[]);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  async function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= assets.length) return;
    const next = [...assets];
    [next[idx], next[target]] = [next[target], next[idx]];
    setAssets(next);
    setReordering(true);
    const { error } = await supabase.functions.invoke("deal-assets-reorder", {
      body: { campaign_id: campaignId, ordered_asset_ids: next.map((a) => a.id) },
    });
    setReordering(false);
    if (error) {
      toast.error("Échec du réordonnancement");
      load();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Contenu du deal</CardTitle>
            <CardDescription>
              {assets.length} / {MAX_ACTIVE} contenus actifs · ordre d'affichage côté prospect
            </CardDescription>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            disabled={assets.length >= MAX_ACTIVE}
            className="rounded-cta"
          >
            <Plus className="h-4 w-4 mr-1" /> Ajouter un contenu
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-2">
              <p className="font-medium text-foreground">Aucun contenu pour le moment</p>
              <p className="text-sm text-muted-foreground">
                Ajoutez un enregistrement, importez un fichier, réutilisez un contenu de votre bibliothèque ou collez un lien.
              </p>
              <Button onClick={() => setAddOpen(true)} className="rounded-cta mt-2">
                <Plus className="h-4 w-4 mr-1" /> Ajouter le premier contenu
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {reordering && (
                <p className="text-xs text-muted-foreground">Réorganisation…</p>
              )}
              {assets.map((a, idx) => (
                <AssetRow
                  key={a.id} asset={a} index={idx} total={assets.length}
                  onMove={(dir) => move(idx, dir)}
                  onChange={load}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProspectQuestionsSection campaignId={campaignId} />

      <AddAssetSheet
        open={addOpen} onOpenChange={setAddOpen}
        campaignId={campaignId} orgId={orgId} companyName={companyName}
        onAttached={load}
      />
    </div>
  );
}
