export interface EditorLayer {
  id: string;
  type: "text" | "logo" | "shape";
  label: string;
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  timing: { start: number; end: number };
  style: LayerStyle;
  visible: boolean;
  locked: boolean;
}

export interface LayerStyle {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  borderRadius?: number;
  padding?: number;
  textAlign?: "left" | "center" | "right";
  animation?: "none" | "fadeIn" | "slideUp" | "slideLeft" | "typewriter";
  letterSpacing?: number;
  lineHeight?: number;
  textShadow?: string;
}

export interface BusinessCardConfig {
  enabled: boolean;
  duration: number;
  name: string;
  title: string;
  email: string;
  phone: string;
  photoUrl: string;
  logoUrl: string;
  style: "minimal" | "corporate" | "modern" | "bold";
}

export interface AudioConfig {
  url: string;
  fileName: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface EditorStylePreset {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  titleStyle: Partial<LayerStyle>;
  subtitleStyle: Partial<LayerStyle>;
  businessCardStyle: BusinessCardConfig["style"];
}

export interface EditorProject {
  videoUrl: string;
  videoDuration: number;
  layers: EditorLayer[];
  activeLayerId: string | null;
  currentTime: number;
  isPlaying: boolean;
  stylePreset: string;
  businessCard: BusinessCardConfig;
  audio: AudioConfig | null;
  zoom: number;
}

export type EditorAction =
  | { type: "SET_VIDEO"; url: string; duration: number }
  | { type: "ADD_LAYER"; layer: EditorLayer }
  | { type: "UPDATE_LAYER"; id: string; updates: Partial<EditorLayer> }
  | { type: "DELETE_LAYER"; id: string }
  | { type: "SELECT_LAYER"; id: string | null }
  | { type: "REORDER_LAYERS"; layers: EditorLayer[] }
  | { type: "SET_TIME"; time: number }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "SET_STYLE_PRESET"; presetId: string }
  | { type: "UPDATE_BUSINESS_CARD"; config: Partial<BusinessCardConfig> }
  | { type: "SET_AUDIO"; audio: AudioConfig | null }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "APPLY_PRESET"; preset: EditorStylePreset }
  | { type: "LOAD_PROJECT"; project: EditorProject };
