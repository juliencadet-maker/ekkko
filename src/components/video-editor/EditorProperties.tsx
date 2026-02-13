import { useEditor } from "./EditorContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Trash2, CreditCard, Music, Upload } from "lucide-react";
import { useRef } from "react";

export function EditorProperties() {
  const { state, dispatch, activeLayer } = useEditor();
  const audioInputRef = useRef<HTMLInputElement>(null);

  if (!activeLayer) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p>Sélectionnez un élément pour modifier ses propriétés</p>
      </div>
    );
  }

  const update = (updates: Record<string, unknown>) => {
    dispatch({ type: "UPDATE_LAYER", id: activeLayer.id, updates: updates as any });
  };

  const updateStyle = (styleUpdates: Record<string, unknown>) => {
    dispatch({
      type: "UPDATE_LAYER",
      id: activeLayer.id,
      updates: { style: { ...activeLayer.style, ...styleUpdates } },
    });
  };

  return (
    <div className="p-3 space-y-4 overflow-y-auto text-sm">
      <div>
        <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider mb-2">
          {activeLayer.type === "text" ? "Texte" : activeLayer.type === "logo" ? "Logo" : "Forme"}
        </h3>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Label</Label>
            <Input
              value={activeLayer.label}
              onChange={(e) => update({ label: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          {activeLayer.type === "text" && (
            <div>
              <Label className="text-xs">Contenu</Label>
              <textarea
                value={activeLayer.content}
                onChange={(e) => update({ content: e.target.value })}
                className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-xs resize-none"
              />
            </div>
          )}
          {activeLayer.type === "logo" && (
            <div>
              <Label className="text-xs">URL du logo</Label>
              <Input
                value={activeLayer.content}
                onChange={(e) => update({ content: e.target.value })}
                className="h-8 text-xs"
                placeholder="https://..."
              />
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Position & Size */}
      <div>
        <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider mb-2">Position</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">X (%)</Label>
            <Input
              type="number"
              value={activeLayer.position.x}
              onChange={(e) => update({ position: { ...activeLayer.position, x: Number(e.target.value) } })}
              className="h-8 text-xs"
              min={0}
              max={100}
            />
          </div>
          <div>
            <Label className="text-xs">Y (%)</Label>
            <Input
              type="number"
              value={activeLayer.position.y}
              onChange={(e) => update({ position: { ...activeLayer.position, y: Number(e.target.value) } })}
              className="h-8 text-xs"
              min={0}
              max={100}
            />
          </div>
          <div>
            <Label className="text-xs">Largeur (%)</Label>
            <Input
              type="number"
              value={activeLayer.size.width}
              onChange={(e) => update({ size: { ...activeLayer.size, width: Number(e.target.value) } })}
              className="h-8 text-xs"
              min={1}
              max={100}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Timing */}
      <div>
        <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider mb-2">Timing</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Début (s)</Label>
            <Input
              type="number"
              value={activeLayer.timing.start}
              onChange={(e) =>
                update({ timing: { ...activeLayer.timing, start: Number(e.target.value) } })
              }
              className="h-8 text-xs"
              min={0}
              step={0.5}
            />
          </div>
          <div>
            <Label className="text-xs">Fin (s)</Label>
            <Input
              type="number"
              value={activeLayer.timing.end}
              onChange={(e) =>
                update({ timing: { ...activeLayer.timing, end: Number(e.target.value) } })
              }
              className="h-8 text-xs"
              min={0}
              step={0.5}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Style */}
      {activeLayer.type === "text" && (
        <div>
          <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider mb-2">Style</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Taille police</Label>
                <Input
                  type="number"
                  value={activeLayer.style.fontSize || 16}
                  onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
                  className="h-8 text-xs"
                  min={8}
                  max={120}
                />
              </div>
              <div>
                <Label className="text-xs">Poids</Label>
                <Select
                  value={activeLayer.style.fontWeight || "400"}
                  onValueChange={(v) => updateStyle({ fontWeight: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="300">Light</SelectItem>
                    <SelectItem value="400">Normal</SelectItem>
                    <SelectItem value="500">Medium</SelectItem>
                    <SelectItem value="600">Semibold</SelectItem>
                    <SelectItem value="700">Bold</SelectItem>
                    <SelectItem value="800">Extrabold</SelectItem>
                    <SelectItem value="900">Black</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Couleur texte</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={activeLayer.style.color || "#ffffff"}
                    onChange={(e) => updateStyle({ color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <Input
                    value={activeLayer.style.color || "#ffffff"}
                    onChange={(e) => updateStyle({ color: e.target.value })}
                    className="h-8 text-xs flex-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Fond</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={activeLayer.style.backgroundColor?.replace(/rgba?\(.*\)/, "#000000") || "#000000"}
                    onChange={(e) => updateStyle({ backgroundColor: e.target.value + "dd" })}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <Input
                    value={activeLayer.style.backgroundColor || "transparent"}
                    onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                    className="h-8 text-xs flex-1"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Alignement</Label>
              <Select
                value={activeLayer.style.textAlign || "left"}
                onValueChange={(v) => updateStyle({ textAlign: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Gauche</SelectItem>
                  <SelectItem value="center">Centre</SelectItem>
                  <SelectItem value="right">Droite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Animation</Label>
              <Select
                value={activeLayer.style.animation || "none"}
                onValueChange={(v) => updateStyle({ animation: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  <SelectItem value="fadeIn">Fondu</SelectItem>
                  <SelectItem value="slideUp">Glissé haut</SelectItem>
                  <SelectItem value="slideLeft">Glissé gauche</SelectItem>
                  <SelectItem value="typewriter">Machine à écrire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Opacité</Label>
              <Slider
                value={[(activeLayer.style.opacity ?? 1) * 100]}
                onValueChange={([v]) => updateStyle({ opacity: v / 100 })}
                min={0}
                max={100}
                step={5}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      )}

      <Separator />

      <Button
        variant="destructive"
        size="sm"
        className="w-full"
        onClick={() => dispatch({ type: "DELETE_LAYER", id: activeLayer.id })}
      >
        <Trash2 className="mr-2 h-3 w-3" />
        Supprimer
      </Button>
    </div>
  );
}

export function BusinessCardPanel() {
  const { state, dispatch } = useEditor();
  const bc = state.businessCard;

  const update = (updates: Record<string, unknown>) => {
    dispatch({ type: "UPDATE_BUSINESS_CARD", config: updates as any });
  };

  return (
    <div className="p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">
          Carte de visite
        </h3>
        <Switch checked={bc.enabled} onCheckedChange={(v) => update({ enabled: v })} />
      </div>
      {bc.enabled && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nom complet</Label>
            <Input value={bc.name} onChange={(e) => update({ name: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Titre / Poste</Label>
            <Input value={bc.title} onChange={(e) => update({ title: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input value={bc.email} onChange={(e) => update({ email: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Téléphone</Label>
            <Input value={bc.phone} onChange={(e) => update({ phone: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">URL Photo</Label>
            <Input value={bc.photoUrl} onChange={(e) => update({ photoUrl: e.target.value })} className="h-8 text-xs" placeholder="https://..." />
          </div>
          <div>
            <Label className="text-xs">URL Logo</Label>
            <Input value={bc.logoUrl} onChange={(e) => update({ logoUrl: e.target.value })} className="h-8 text-xs" placeholder="https://..." />
          </div>
          <div>
            <Label className="text-xs">Durée (secondes)</Label>
            <Input type="number" value={bc.duration} onChange={(e) => update({ duration: Number(e.target.value) })} className="h-8 text-xs" min={2} max={15} />
          </div>
          <div>
            <Label className="text-xs">Style</Label>
            <Select value={bc.style} onValueChange={(v) => update({ style: v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal">Minimaliste</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
                <SelectItem value="modern">Moderne</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

export function AudioPanel() {
  const { state, dispatch } = useEditor();
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    dispatch({
      type: "SET_AUDIO",
      audio: {
        url,
        fileName: file.name,
        volume: 0.3,
        fadeIn: 2,
        fadeOut: 3,
      },
    });
  };

  return (
    <div className="p-3 space-y-3 text-sm">
      <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">
        Musique de fond
      </h3>
      {!state.audio ? (
        <div>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleAudioUpload}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => audioInputRef.current?.click()}
          >
            <Upload className="mr-2 h-3 w-3" />
            Importer un fichier audio
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
            <Music className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs truncate flex-1">{state.audio.fileName}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => dispatch({ type: "SET_AUDIO", audio: null })}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div>
            <Label className="text-xs">Volume</Label>
            <Slider
              value={[state.audio.volume * 100]}
              onValueChange={([v]) =>
                dispatch({ type: "SET_AUDIO", audio: { ...state.audio!, volume: v / 100 } })
              }
              min={0}
              max={100}
              step={5}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fade in (s)</Label>
              <Input
                type="number"
                value={state.audio.fadeIn}
                onChange={(e) =>
                  dispatch({ type: "SET_AUDIO", audio: { ...state.audio!, fadeIn: Number(e.target.value) } })
                }
                className="h-8 text-xs"
                min={0}
                step={0.5}
              />
            </div>
            <div>
              <Label className="text-xs">Fade out (s)</Label>
              <Input
                type="number"
                value={state.audio.fadeOut}
                onChange={(e) =>
                  dispatch({ type: "SET_AUDIO", audio: { ...state.audio!, fadeOut: Number(e.target.value) } })
                }
                className="h-8 text-xs"
                min={0}
                step={0.5}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
