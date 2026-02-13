import { createContext, useContext, useReducer, ReactNode } from "react";
import type { EditorProject, EditorAction, EditorLayer, EditorStylePreset } from "./types";
import { STYLE_PRESETS } from "./stylePresets";

const defaultBusinessCard = {
  enabled: true,
  duration: 5,
  name: "",
  title: "",
  email: "",
  phone: "",
  photoUrl: "",
  logoUrl: "",
  style: "corporate" as const,
};

const initialState: EditorProject = {
  videoUrl: "",
  videoDuration: 0,
  layers: [],
  activeLayerId: null,
  currentTime: 0,
  isPlaying: false,
  stylePreset: "corporate",
  businessCard: defaultBusinessCard,
  audio: null,
  zoom: 1,
};

function editorReducer(state: EditorProject, action: EditorAction): EditorProject {
  switch (action.type) {
    case "SET_VIDEO":
      return { ...state, videoUrl: action.url, videoDuration: action.duration };
    case "ADD_LAYER":
      return { ...state, layers: [...state.layers, action.layer], activeLayerId: action.layer.id };
    case "UPDATE_LAYER":
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.id ? { ...l, ...action.updates, style: { ...l.style, ...(action.updates.style || {}) } } : l
        ),
      };
    case "DELETE_LAYER":
      return {
        ...state,
        layers: state.layers.filter((l) => l.id !== action.id),
        activeLayerId: state.activeLayerId === action.id ? null : state.activeLayerId,
      };
    case "SELECT_LAYER":
      return { ...state, activeLayerId: action.id };
    case "REORDER_LAYERS":
      return { ...state, layers: action.layers };
    case "SET_TIME":
      return { ...state, currentTime: action.time };
    case "SET_PLAYING":
      return { ...state, isPlaying: action.playing };
    case "SET_STYLE_PRESET":
      return { ...state, stylePreset: action.presetId };
    case "UPDATE_BUSINESS_CARD":
      return { ...state, businessCard: { ...state.businessCard, ...action.config } };
    case "SET_AUDIO":
      return { ...state, audio: action.audio };
    case "SET_ZOOM":
      return { ...state, zoom: action.zoom };
    case "APPLY_PRESET": {
      const preset = action.preset;
      const updatedLayers = state.layers.map((layer) => {
        if (layer.label.toLowerCase().includes("titre") && !layer.label.toLowerCase().includes("sous")) {
          return { ...layer, style: { ...layer.style, ...preset.titleStyle } };
        }
        if (layer.label.toLowerCase().includes("sous-titre") || layer.label.toLowerCase().includes("subtitle")) {
          return { ...layer, style: { ...layer.style, ...preset.subtitleStyle } };
        }
        return layer;
      });
      return {
        ...state,
        layers: updatedLayers,
        stylePreset: preset.id,
        businessCard: { ...state.businessCard, style: preset.businessCardStyle },
      };
    }
    case "LOAD_PROJECT":
      return action.project;
    default:
      return state;
  }
}

interface EditorContextType {
  state: EditorProject;
  dispatch: React.Dispatch<EditorAction>;
  activeLayer: EditorLayer | null;
  currentPreset: EditorStylePreset | undefined;
  isLayerVisible: (layer: EditorLayer) => boolean;
}

const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  const activeLayer = state.layers.find((l) => l.id === state.activeLayerId) || null;
  const currentPreset = STYLE_PRESETS.find((p) => p.id === state.stylePreset);

  const isLayerVisible = (layer: EditorLayer) => {
    if (!layer.visible) return false;
    const t = state.currentTime;
    return t >= layer.timing.start && t <= layer.timing.end;
  };

  return (
    <EditorContext.Provider value={{ state, dispatch, activeLayer, currentPreset, isLayerVisible }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
