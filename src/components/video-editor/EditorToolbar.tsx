import { useEditor } from "./EditorContext";
import { Button } from "@/components/ui/button";
import { STYLE_PRESETS } from "./stylePresets";
import {
  Type,
  Image,
  Square,
  Save,
  Undo2,
  Redo2,
  Palette,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function EditorToolbar({ onSave }: { onSave: () => void }) {
  const { state, dispatch, currentPreset } = useEditor();

  const addTextLayer = () => {
    const id = crypto.randomUUID();
    dispatch({
      type: "ADD_LAYER",
      layer: {
        id,
        type: "text",
        label: "Titre",
        content: "Votre titre ici",
        position: { x: 5, y: 75 },
        size: { width: 60, height: 10 },
        timing: { start: 0, end: Math.min(state.videoDuration || 30, 10) },
        style: currentPreset?.titleStyle
          ? { ...currentPreset.titleStyle }
          : {
              fontSize: 32,
              fontWeight: "700",
              color: "#ffffff",
              backgroundColor: "rgba(26, 39, 68, 0.85)",
              padding: 16,
              borderRadius: 8,
              textAlign: "left" as const,
              animation: "fadeIn" as const,
              opacity: 1,
            },
        visible: true,
        locked: false,
      },
    });
  };

  const addSubtitleLayer = () => {
    const id = crypto.randomUUID();
    dispatch({
      type: "ADD_LAYER",
      layer: {
        id,
        type: "text",
        label: "Sous-titre",
        content: "Votre sous-titre ici",
        position: { x: 5, y: 85 },
        size: { width: 50, height: 8 },
        timing: { start: 2, end: Math.min(state.videoDuration || 30, 12) },
        style: currentPreset?.subtitleStyle
          ? { ...currentPreset.subtitleStyle }
          : {
              fontSize: 18,
              fontWeight: "400",
              color: "#e0e0e0",
              backgroundColor: "rgba(26, 39, 68, 0.7)",
              padding: 12,
              borderRadius: 6,
              textAlign: "left" as const,
              animation: "fadeIn" as const,
              opacity: 1,
            },
        visible: true,
        locked: false,
      },
    });
  };

  const addLogoLayer = () => {
    const id = crypto.randomUUID();
    dispatch({
      type: "ADD_LAYER",
      layer: {
        id,
        type: "logo",
        label: "Logo",
        content: "",
        position: { x: 82, y: 4 },
        size: { width: 14, height: 10 },
        timing: { start: 0, end: state.videoDuration || 30 },
        style: { opacity: 0.85 },
        visible: true,
        locked: false,
      },
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = STYLE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      dispatch({ type: "APPLY_PRESET", preset });
      toast.success(`Style "${preset.name}" appliqué`);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-card">
      {/* Add elements */}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={addTextLayer} className="h-8 text-xs">
          <Type className="mr-1.5 h-3.5 w-3.5" />
          Titre
        </Button>
        <Button variant="outline" size="sm" onClick={addSubtitleLayer} className="h-8 text-xs">
          <Type className="mr-1.5 h-3 w-3" />
          Sous-titre
        </Button>
        <Button variant="outline" size="sm" onClick={addLogoLayer} className="h-8 text-xs">
          <Image className="mr-1.5 h-3.5 w-3.5" />
          Logo
        </Button>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Style presets */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <Palette className="mr-1.5 h-3.5 w-3.5" />
            {currentPreset?.name || "Style"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STYLE_PRESETS.map((preset) => (
            <DropdownMenuItem key={preset.id} onClick={() => applyPreset(preset.id)}>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: preset.primaryColor }}
                />
                <div>
                  <span className="font-medium">{preset.name}</span>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      {/* Save */}
      <Button size="sm" className="h-8 text-xs" onClick={onSave}>
        <Save className="mr-1.5 h-3.5 w-3.5" />
        Sauvegarder
      </Button>
    </div>
  );
}
