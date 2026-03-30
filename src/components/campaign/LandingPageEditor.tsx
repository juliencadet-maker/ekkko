import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Upload, Image, Palette, MousePointerClick, Eye, ExternalLink, Copy, Shield, Plus, Trash2, Globe, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface LandingPageConfig {
  logoUrl: string | null;
  brandColor: string;
  ctaText: string;
  ctaUrl: string;
  headline: string;
  subheadline: string;
}

interface AccessEntry {
  id?: string;
  access_type: "email" | "domain";
  email?: string;
  domain?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
}

interface LandingPageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  videoUrl: string;
  orgId: string;
  initialConfig?: LandingPageConfig;
  onSave: (config: LandingPageConfig) => void;
}

const DEFAULT_CONFIG: LandingPageConfig = {
  logoUrl: null,
  brandColor: "#1e3a5f",
  ctaText: "Prendre rendez-vous",
  ctaUrl: "https://calendly.com",
  headline: "Un message personnalisé pour vous",
  subheadline: "Découvrez notre vidéo exclusive",
};

const PRESET_COLORS = [
  "#1e3a5f", "#0066cc", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#374151",
];

export function LandingPageEditor({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  videoUrl,
  orgId,
  initialConfig,
  onSave,
}: LandingPageEditorProps) {
  const [config, setConfig] = useState<LandingPageConfig>(initialConfig || DEFAULT_CONFIG);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialConfig?.logoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Access control state
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);

  // Load existing access list
  useEffect(() => {
    if (!open || !campaignId) return;
    const loadAccessList = async () => {
      setIsLoadingAccess(true);
      try {
        const { data } = await supabase
          .from("video_access_list")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: true });
        if (data) {
          setAccessList(data.map((d: any) => ({
            id: d.id,
            access_type: d.access_type,
            email: d.email,
            domain: d.domain,
            first_name: d.first_name,
            last_name: d.last_name,
            title: d.title,
          })));
        }
      } catch {
        console.error("Failed to load access list");
      } finally {
        setIsLoadingAccess(false);
      }
    };
    loadAccessList();
  }, [open, campaignId]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Le fichier est trop volumineux (max 2MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setLogoPreview(dataUrl);
        setConfig(prev => ({ ...prev, logoUrl: dataUrl }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setConfig(prev => ({ ...prev, logoUrl: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddViewer = async () => {
    if (!newEmail.trim()) {
      toast.error("L'email est obligatoire");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("video_access_list")
        .insert({
          campaign_id: campaignId,
          org_id: orgId,
          access_type: "email",
          email: newEmail.trim().toLowerCase(),
          first_name: newFirstName.trim() || null,
          last_name: newLastName.trim() || null,
          title: newTitle.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      setAccessList(prev => [...prev, {
        id: data.id,
        access_type: "email",
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        title: data.title,
      }]);
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setNewTitle("");
      toast.success("Viewer ajouté");
    } catch {
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      toast.error("Le domaine est obligatoire");
      return;
    }
    const domain = newDomain.trim().toLowerCase().replace(/^@/, "");
    try {
      const { data, error } = await supabase
        .from("video_access_list")
        .insert({
          campaign_id: campaignId,
          org_id: orgId,
          access_type: "domain",
          domain,
        })
        .select()
        .single();
      if (error) throw error;
      setAccessList(prev => [...prev, {
        id: data.id,
        access_type: "domain",
        domain: data.domain,
      }]);
      setNewDomain("");
      toast.success(`Domaine @${domain} ajouté`);
    } catch {
      toast.error("Erreur lors de l'ajout du domaine");
    }
  };

  const handleRemoveAccess = async (entry: AccessEntry) => {
    if (!entry.id) return;
    try {
      const { error } = await supabase
        .from("video_access_list")
        .delete()
        .eq("id", entry.id);
      if (error) throw error;
      setAccessList(prev => prev.filter(a => a.id !== entry.id));
      toast.success("Accès supprimé");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleSave = () => {
    onSave(config);
    toast.success("Landing page configurée avec succès");
    onOpenChange(false);
  };

  const landingPageUrl = `${window.location.origin}/lp/${campaignId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(landingPageUrl);
    toast.success("Lien copié dans le presse-papier");
  };

  const emailEntries = accessList.filter(a => a.access_type === "email");
  const domainEntries = accessList.filter(a => a.access_type === "domain");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une landing page</DialogTitle>
          <DialogDescription>
            Personnalisez votre page de destination pour "{campaignName}"
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Editor Panel */}
          <div className="space-y-6">
            <Tabs defaultValue="branding" className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="branding">
                  <Palette className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Marque</span>
                </TabsTrigger>
                <TabsTrigger value="content">
                  <Image className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Contenu</span>
                </TabsTrigger>
                <TabsTrigger value="cta">
                  <MousePointerClick className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">CTA</span>
                </TabsTrigger>
                <TabsTrigger value="access">
                  <Shield className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Accès</span>
                </TabsTrigger>
              </TabsList>

              {/* Branding Tab */}
              <TabsContent value="branding" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Logo de l'entreprise</Label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <div className="relative w-20 h-20 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        {logoPreview ? "Changer" : "Télécharger"}
                      </Button>
                      {logoPreview && (
                        <Button variant="ghost" size="sm" onClick={handleRemoveLogo}>Supprimer</Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Max 2MB.</p>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label>Couleur de la marque</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          config.brandColor === color ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setConfig(prev => ({ ...prev, brandColor: color }))}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="customColor" className="text-sm text-muted-foreground">Personnalisé:</Label>
                    <Input id="customColor" type="color" value={config.brandColor} onChange={(e) => setConfig(prev => ({ ...prev, brandColor: e.target.value }))} className="w-12 h-8 p-0 border-0 cursor-pointer" />
                    <Input value={config.brandColor} onChange={(e) => setConfig(prev => ({ ...prev, brandColor: e.target.value }))} className="w-24 font-mono text-sm" placeholder="#000000" />
                  </div>
                </div>
              </TabsContent>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="headline">Titre principal</Label>
                  <Input id="headline" value={config.headline} onChange={(e) => setConfig(prev => ({ ...prev, headline: e.target.value }))} placeholder="Un message personnalisé pour vous" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subheadline">Sous-titre</Label>
                  <Input id="subheadline" value={config.subheadline} onChange={(e) => setConfig(prev => ({ ...prev, subheadline: e.target.value }))} placeholder="Découvrez notre vidéo exclusive" />
                </div>
              </TabsContent>

              {/* CTA Tab */}
              <TabsContent value="cta" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="ctaText">Texte du bouton</Label>
                  <Input id="ctaText" value={config.ctaText} onChange={(e) => setConfig(prev => ({ ...prev, ctaText: e.target.value }))} placeholder="Prendre rendez-vous" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ctaUrl">URL de destination</Label>
                  <Input id="ctaUrl" type="url" value={config.ctaUrl} onChange={(e) => setConfig(prev => ({ ...prev, ctaUrl: e.target.value }))} placeholder="https://calendly.com/..." />
                  <p className="text-xs text-muted-foreground">Lien vers votre calendrier, formulaire de contact, etc.</p>
                </div>
              </TabsContent>

              {/* Access Control Tab */}
              <TabsContent value="access" className="space-y-5 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Contrôlez qui peut voir cette vidéo. Sans restriction, elle est accessible à tous.
                  </p>

                  {/* Domain-based access */}
                  <div className="space-y-3 mb-6">
                    <Label className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Domaines autorisés
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Toutes les personnes avec une adresse @domaine.com pourront accéder à la vidéo.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="vusion.com"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                        className="flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={handleAddDomain}>
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter
                      </Button>
                    </div>
                    {domainEntries.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {domainEntries.map((entry) => (
                          <Badge key={entry.id} variant="secondary" className="gap-1.5 py-1 px-3">
                            <Globe className="h-3 w-3" />
                            @{entry.domain}
                            <button onClick={() => handleRemoveAccess(entry)} className="ml-1 hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Individual viewer access */}
                  <div className="space-y-3 mt-4">
                    <Label className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Viewers individuels
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Ajoutez des personnes spécifiques qui peuvent voir la vidéo.
                    </p>
                    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Prénom" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
                        <Input placeholder="Nom" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
                      </div>
                      <Input placeholder="Email *" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                      <Input placeholder="Titre / Poste" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                      <Button variant="outline" size="sm" className="w-full" onClick={handleAddViewer}>
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter ce viewer
                      </Button>
                    </div>

                    {emailEntries.length > 0 && (
                      <div className="space-y-2 mt-3">
                        {emailEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                            <div className="flex items-center gap-3 min-w-0">
                              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {entry.first_name || entry.last_name
                                    ? `${entry.first_name || ""} ${entry.last_name || ""}`.trim()
                                    : entry.email}
                                </p>
                                {(entry.first_name || entry.last_name) && (
                                  <p className="text-xs text-muted-foreground truncate">{entry.email}</p>
                                )}
                                {entry.title && (
                                  <p className="text-xs text-muted-foreground">{entry.title}</p>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleRemoveAccess(entry)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {accessList.length > 0 && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-primary font-medium">
                      🔒 {accessList.length} règle{accessList.length > 1 ? "s" : ""} d'accès configurée{accessList.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Seules les personnes correspondant à ces règles pourront voir la vidéo. Les autres devront s'identifier.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Panel */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="h-4 w-4" />
              Aperçu
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="min-h-[400px] flex flex-col" style={{ backgroundColor: config.brandColor + "10" }}>
                  <div className="p-4 flex items-center justify-center" style={{ backgroundColor: config.brandColor }}>
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="h-10 max-w-[150px] object-contain" style={{ filter: "brightness(0) invert(1)" }} />
                    ) : (
                      <div className="h-10 px-4 flex items-center text-white font-semibold">Votre Logo</div>
                    )}
                  </div>
                  <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                    <input type="text" value={config.headline} onChange={(e) => setConfig(prev => ({ ...prev, headline: e.target.value }))} placeholder="Titre principal" className="text-xl font-bold mb-2 bg-transparent border-none text-center w-full focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-2 py-1" style={{ color: config.brandColor }} />
                    <input type="text" value={config.subheadline} onChange={(e) => setConfig(prev => ({ ...prev, subheadline: e.target.value }))} placeholder="Sous-titre" className="text-sm text-muted-foreground mb-4 bg-transparent border-none text-center w-full focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-2 py-1" />
                    <div className="w-full aspect-video bg-black/90 rounded-lg mb-6 flex items-center justify-center">
                      <div className="text-white/60 text-sm">Vidéo</div>
                    </div>
                    <input type="text" value={config.ctaText} onChange={(e) => setConfig(prev => ({ ...prev, ctaText: e.target.value }))} placeholder="Call to action" className="px-6 py-3 rounded-lg text-white font-medium text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-white/30" style={{ backgroundColor: config.brandColor }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Share Link */}
        <div className="space-y-2">
          <Label>Lien de la landing page</Label>
          <div className="flex gap-2">
            <Input value={landingPageUrl} readOnly className="font-mono text-sm" />
            <Button variant="outline" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copier
            </Button>
            <Button variant="outline" onClick={() => window.open(landingPageUrl, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Ouvrir
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave}>Enregistrer et publier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
