// Phase 1d.5d-1 — Add Asset Sheet (drawer) with 4 sources :
//   1. Enregistrer (FacecamRecorder)
//   2. Importer (upload local → bucket deal-videos)
//   3. Depuis biblio (assets table → copie isolée D72 Q4)
//   4. Lien externe (URL)
//
// Toutes les sources appellent ensuite l'edge fn `deal-assets-attach`.

import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FacecamRecorder } from "@/components/campaign/FacecamRecorder";
import { VideoImportUpload } from "@/components/campaign/VideoImportUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EkkoLoader } from "@/components/EkkoLoader";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  orgId: string;
  companyName: string;
  onAttached: () => void;
}

const PURPOSES = [
  { value: "intro", label: "Présentation" },
  { value: "pricing", label: "Proposition commerciale" },
  { value: "technical", label: "Détails techniques" },
  { value: "closing", label: "Éléments de clôture" },
  { value: "other", label: "Document complémentaire" },
];

async function callAttach(payload: {
  campaign_id: string; asset_type: string; asset_purpose: string;
  file_url: string; block_title?: string; block_description?: string;
}) {
  const { data, error } = await supabase.functions.invoke("deal-assets-attach", {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error === "ASSET_CAP_REACHED"
    ? "Limite atteinte (12 contenus actifs maximum sur ce deal)."
    : data.error);
  return data;
}

export function AddAssetSheet({
  open, onOpenChange, campaignId, orgId, companyName, onAttached,
}: Props) {
  const [tab, setTab] = useState("record");
  const [purpose, setPurpose] = useState("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  // Record
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  // Import
  const [importedFile, setImportedFile] = useState<File | null>(null);
  // Library
  const [libraryAssets, setLibraryAssets] = useState<Array<{ id: string; name: string; storage_path: string; asset_type: string; purpose: string | null }>>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>("");
  // Link
  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setRecordedBlob(null);
    setImportedFile(null);
    setLinkUrl("");
    setTitle("");
    setDescription("");
    setPurpose("other");
    (async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, name, storage_path, asset_type, purpose")
        .eq("org_id", orgId)
        .is("archived_at", null)
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .limit(50);
      setLibraryAssets((data ?? []) as any);
    })();
  }, [open, orgId]);

  async function handleRecordSubmit() {
    if (!recordedBlob) { toast.error("Aucun enregistrement"); return; }
    setBusy(true);
    try {
      const path = `${orgId}/${campaignId}/record-${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage
        .from("deal-videos").upload(path, recordedBlob, { contentType: "video/webm" });
      if (upErr) throw upErr;
      await callAttach({
        campaign_id: campaignId, asset_type: "video", asset_purpose: purpose,
        file_url: path, block_title: title.trim() || undefined,
        block_description: description.trim() || undefined,
      });
      toast.success("Enregistrement ajouté");
      onAttached(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'ajout");
    } finally { setBusy(false); }
  }

  async function handleImportSubmit() {
    if (!importedFile) { toast.error("Aucun fichier sélectionné"); return; }
    setBusy(true);
    try {
      const ext = importedFile.name.split(".").pop() || "mp4";
      const path = `${orgId}/${campaignId}/upload-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("deal-videos").upload(path, importedFile, { contentType: importedFile.type || "video/mp4" });
      if (upErr) throw upErr;
      const isVideo = (importedFile.type || "").startsWith("video/");
      const isPdf = (importedFile.type || "").includes("pdf") || ext.toLowerCase() === "pdf";
      const assetType = isVideo ? "video" : (isPdf ? "pdf" : "doc");
      await callAttach({
        campaign_id: campaignId, asset_type: assetType, asset_purpose: purpose,
        file_url: path, block_title: title.trim() || importedFile.name,
        block_description: description.trim() || undefined,
      });
      toast.success("Fichier ajouté");
      onAttached(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'upload");
    } finally { setBusy(false); }
  }

  async function handleLibrarySubmit() {
    const lib = libraryAssets.find((a) => a.id === selectedLibraryId);
    if (!lib) { toast.error("Sélectionnez un contenu de la bibliothèque"); return; }
    setBusy(true);
    try {
      // Copie isolée (D72 Q4) : on snapshot le storage_path tel quel.
      // La bibliothèque ne propage pas ses futurs changements aux deals existants.
      await callAttach({
        campaign_id: campaignId,
        asset_type: lib.asset_type || "doc",
        asset_purpose: lib.purpose || purpose,
        file_url: lib.storage_path,
        block_title: title.trim() || lib.name,
        block_description: description.trim() || undefined,
      });
      // Best-effort usage tracking
      await supabase.from("assets")
        .update({ usage_count: (libraryAssets as any).find((a: any) => a.id === selectedLibraryId)?.usage_count
          ? undefined : 1, last_used_at: new Date().toISOString(), last_used_for_company: companyName })
        .eq("id", selectedLibraryId);
      toast.success("Contenu réutilisé depuis la bibliothèque");
      onAttached(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'ajout");
    } finally { setBusy(false); }
  }

  async function handleLinkSubmit() {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("URL invalide (https:// requis)"); return;
    }
    setBusy(true);
    try {
      await callAttach({
        campaign_id: campaignId, asset_type: "link", asset_purpose: purpose,
        file_url: url, block_title: title.trim() || url,
        block_description: description.trim() || undefined,
      });
      toast.success("Lien ajouté");
      onAttached(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'ajout");
    } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Ajouter un contenu au deal</SheetTitle>
          <SheetDescription>
            12 contenus actifs maximum. L'ordre d'affichage côté prospect peut être ajusté ensuite.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purpose">Type de bloc</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger id="purpose"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURPOSES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Titre (visible prospect)</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description courte (optionnel)</Label>
            <Textarea id="desc" rows={2} maxLength={1000}
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="record">Enregistrer</TabsTrigger>
              <TabsTrigger value="import">Importer</TabsTrigger>
              <TabsTrigger value="library">Bibliothèque</TabsTrigger>
              <TabsTrigger value="link">Lien</TabsTrigger>
            </TabsList>

            <TabsContent value="record" className="mt-4 space-y-3">
              <FacecamRecorder
                company={companyName}
                contactName=""
                onRecorded={(b) => setRecordedBlob(b)}
                onClear={() => setRecordedBlob(null)}
                recordedBlob={recordedBlob}
              />
              <Button onClick={handleRecordSubmit} disabled={busy || !recordedBlob} className="w-full">
                {busy ? <EkkoLoader mode="once" size={14} /> : "Ajouter au deal"}
              </Button>
            </TabsContent>

            <TabsContent value="import" className="mt-4 space-y-3">
              <VideoImportUpload
                selectedFile={importedFile}
                onFileSelected={(f: File) => setImportedFile(f)}
                onClear={() => setImportedFile(null)}
              />
              <Button onClick={handleImportSubmit} disabled={busy || !importedFile} className="w-full">
                {busy ? <EkkoLoader mode="once" size={14} /> : "Téléverser & ajouter"}
              </Button>
            </TabsContent>

            <TabsContent value="library" className="mt-4 space-y-3">
              {libraryAssets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun contenu dans votre bibliothèque pour le moment.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {libraryAssets.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedLibraryId(a.id)}
                      className={`w-full text-left rounded-md border p-3 transition ${
                        selectedLibraryId === a.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.asset_type} {a.purpose ? `· ${a.purpose}` : ""}</p>
                    </button>
                  ))}
                </div>
              )}
              <Button onClick={handleLibrarySubmit} disabled={busy || !selectedLibraryId} className="w-full">
                {busy ? <EkkoLoader mode="once" size={14} /> : "Réutiliser (copie isolée)"}
              </Button>
            </TabsContent>

            <TabsContent value="link" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="link">URL externe</Label>
                <Input id="link" placeholder="https://…"
                  value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
              </div>
              <Button onClick={handleLinkSubmit} disabled={busy || !linkUrl.trim()} className="w-full">
                {busy ? <EkkoLoader mode="once" size={14} /> : "Ajouter le lien"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
