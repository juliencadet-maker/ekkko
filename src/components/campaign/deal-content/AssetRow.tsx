// Phase 1d.5d-1 — Single asset row in the "Contenu du deal" management view.
// Inline edit (block_title / block_description), reorder via ↑↓, delete (HYBRIDE).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown, ArrowUp, FileText, Image as ImageIcon, Link as LinkIcon,
  Pencil, Save, Trash2, Video, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DealAssetRow {
  id: string;
  asset_type: string;
  asset_purpose: string;
  file_url: string | null;
  display_order: number;
  block_group: string | null;
  block_title: string | null;
  block_description: string | null;
}

interface Props {
  asset: DealAssetRow;
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onChange: () => void;
}

function typeIcon(t: string) {
  if (t === "video") return <Video className="h-4 w-4" />;
  if (t === "pdf" || t === "doc") return <FileText className="h-4 w-4" />;
  if (t === "image") return <ImageIcon className="h-4 w-4" />;
  if (t === "link") return <LinkIcon className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

const PURPOSE_LABEL: Record<string, string> = {
  intro: "Présentation",
  pricing: "Proposition commerciale",
  technical: "Détails techniques",
  closing: "Éléments de clôture",
  other: "Document",
};

export function AssetRow({ asset, index, total, onMove, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(asset.block_title ?? "");
  const [description, setDescription] = useState(asset.block_description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from("deal_assets")
      .update({
        block_title: title.trim() || null,
        block_description: description.trim() || null,
      })
      .eq("id", asset.id);
    setSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement");
      return;
    }
    toast.success("Bloc mis à jour");
    setEditing(false);
    onChange();
  }

  async function handleDelete() {
    if (!confirm("Retirer ce contenu du deal ?")) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("deal-assets-detach", {
      body: { asset_id: asset.id },
    });
    setDeleting(false);
    if (error) {
      toast.error("Échec de la suppression");
      return;
    }
    if (data?.mode === "soft_delete") {
      toast.success("Contenu archivé (déjà partagé — historique conservé)");
    } else {
      toast.success("Contenu retiré");
    }
    onChange();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 pt-1">
          <Button
            size="icon" variant="ghost" className="h-6 w-6"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Monter"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon" variant="ghost" className="h-6 w-6"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label="Descendre"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
          {typeIcon(asset.asset_type)}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {PURPOSE_LABEL[asset.asset_purpose] || asset.asset_purpose}
            </Badge>
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
          </div>

          {editing ? (
            <div className="space-y-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre du bloc (visible côté prospect)"
                maxLength={200}
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description courte (optionnel, max 1000 caractères)"
                maxLength={1000}
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Enregistrer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  setEditing(false);
                  setTitle(asset.block_title ?? "");
                  setDescription(asset.block_description ?? "");
                }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Annuler
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {asset.block_title || <span className="italic text-muted-foreground">Sans titre — cliquez sur Modifier</span>}
              </p>
              {asset.block_description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{asset.block_description}</p>
              )}
            </>
          )}
        </div>

        {!editing && (
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
            </Button>
            <Button
              size="sm" variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete} disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Retirer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
