import { useState, useRef } from "react";
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
import { Upload, Image, Palette, MousePointerClick, Eye, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";

export interface LandingPageConfig {
  logoUrl: string | null;
  brandColor: string;
  ctaText: string;
  ctaUrl: string;
  headline: string;
  subheadline: string;
}

interface LandingPageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  videoUrl: string;
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
  "#1e3a5f", // Navy (default)
  "#0066cc", // Blue
  "#10b981", // Green
  "#f59e0b", // Orange
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#374151", // Gray
];

export function LandingPageEditor({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  videoUrl,
  initialConfig,
  onSave,
}: LandingPageEditorProps) {
  const [config, setConfig] = useState<LandingPageConfig>(initialConfig || DEFAULT_CONFIG);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialConfig?.logoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="branding">
                  <Palette className="h-4 w-4 mr-2" />
                  Marque
                </TabsTrigger>
                <TabsTrigger value="content">
                  <Image className="h-4 w-4 mr-2" />
                  Contenu
                </TabsTrigger>
                <TabsTrigger value="cta">
                  <MousePointerClick className="h-4 w-4 mr-2" />
                  CTA
                </TabsTrigger>
              </TabsList>

              {/* Branding Tab */}
              <TabsContent value="branding" className="space-y-4 mt-4">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Logo de l'entreprise</Label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <div className="relative w-20 h-20 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        <img 
                          src={logoPreview} 
                          alt="Logo preview" 
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {logoPreview ? "Changer" : "Télécharger"}
                      </Button>
                      {logoPreview && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={handleRemoveLogo}
                        >
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Max 2MB.</p>
                </div>

                <Separator />

                {/* Brand Color */}
                <div className="space-y-3">
                  <Label>Couleur de la marque</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          config.brandColor === color 
                            ? "border-foreground scale-110" 
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setConfig(prev => ({ ...prev, brandColor: color }))}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="customColor" className="text-sm text-muted-foreground">
                      Personnalisé:
                    </Label>
                    <Input
                      id="customColor"
                      type="color"
                      value={config.brandColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, brandColor: e.target.value }))}
                      className="w-12 h-8 p-0 border-0 cursor-pointer"
                    />
                    <Input
                      value={config.brandColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, brandColor: e.target.value }))}
                      className="w-24 font-mono text-sm"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="headline">Titre principal</Label>
                  <Input
                    id="headline"
                    value={config.headline}
                    onChange={(e) => setConfig(prev => ({ ...prev, headline: e.target.value }))}
                    placeholder="Un message personnalisé pour vous"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subheadline">Sous-titre</Label>
                  <Input
                    id="subheadline"
                    value={config.subheadline}
                    onChange={(e) => setConfig(prev => ({ ...prev, subheadline: e.target.value }))}
                    placeholder="Découvrez notre vidéo exclusive"
                  />
                </div>
              </TabsContent>

              {/* CTA Tab */}
              <TabsContent value="cta" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="ctaText">Texte du bouton</Label>
                  <Input
                    id="ctaText"
                    value={config.ctaText}
                    onChange={(e) => setConfig(prev => ({ ...prev, ctaText: e.target.value }))}
                    placeholder="Prendre rendez-vous"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ctaUrl">URL de destination</Label>
                  <Input
                    id="ctaUrl"
                    type="url"
                    value={config.ctaUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, ctaUrl: e.target.value }))}
                    placeholder="https://calendly.com/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Lien vers votre calendrier, formulaire de contact, etc.
                  </p>
                </div>
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
                <div 
                  className="min-h-[400px] flex flex-col"
                  style={{ backgroundColor: config.brandColor + "10" }}
                >
                  {/* Header with logo */}
                  <div 
                    className="p-4 flex items-center justify-center"
                    style={{ backgroundColor: config.brandColor }}
                  >
                    {logoPreview ? (
                      <img 
                        src={logoPreview} 
                        alt="Logo" 
                        className="h-10 max-w-[150px] object-contain"
                        style={{ filter: "brightness(0) invert(1)" }}
                      />
                    ) : (
                      <div className="h-10 px-4 flex items-center text-white font-semibold">
                        Votre Logo
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                    <input 
                      type="text"
                      value={config.headline}
                      onChange={(e) => setConfig(prev => ({ ...prev, headline: e.target.value }))}
                      placeholder="Titre principal"
                      className="text-xl font-bold mb-2 bg-transparent border-none text-center w-full focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-2 py-1"
                      style={{ color: config.brandColor }}
                    />
                    <input 
                      type="text"
                      value={config.subheadline}
                      onChange={(e) => setConfig(prev => ({ ...prev, subheadline: e.target.value }))}
                      placeholder="Sous-titre"
                      className="text-sm text-muted-foreground mb-4 bg-transparent border-none text-center w-full focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-2 py-1"
                    />

                    {/* Video placeholder */}
                    <div className="w-full aspect-video bg-black/90 rounded-lg mb-6 flex items-center justify-center">
                      <div className="text-white/60 text-sm">Vidéo</div>
                    </div>

                    {/* CTA Button - editable */}
                    <input
                      type="text"
                      value={config.ctaText}
                      onChange={(e) => setConfig(prev => ({ ...prev, ctaText: e.target.value }))}
                      placeholder="Call to action"
                      className="px-6 py-3 rounded-lg text-white font-medium text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-white/30"
                      style={{ backgroundColor: config.brandColor }}
                    />
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
            <Input
              value={landingPageUrl}
              readOnly
              className="font-mono text-sm"
            />
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Enregistrer et publier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
