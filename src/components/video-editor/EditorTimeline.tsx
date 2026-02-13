import { useRef, useCallback } from "react";
import { useEditor } from "./EditorContext";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  SkipBack,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Type,
  Image,
  Music,
  CreditCard,
} from "lucide-react";

const TRACK_HEIGHT = 40;
const HEADER_WIDTH = 160;

export function EditorTimeline() {
  const { state, dispatch } = useEditor();
  const timelineRef = useRef<HTMLDivElement>(null);

  const duration = state.videoDuration || 60;
  const pixelsPerSecond = 12 * state.zoom;
  const timelineWidth = duration * pixelsPerSecond;

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - HEADER_WIDTH;
      if (x < 0) return;
      const time = Math.max(0, Math.min(duration, x / pixelsPerSecond));
      dispatch({ type: "SET_TIME", time });
    },
    [duration, pixelsPerSecond, dispatch]
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getLayerIcon = (type: string) => {
    switch (type) {
      case "text": return <Type className="h-3 w-3" />;
      case "logo": return <Image className="h-3 w-3" />;
      default: return <Type className="h-3 w-3" />;
    }
  };

  const getLayerColor = (type: string) => {
    switch (type) {
      case "text": return "bg-blue-500/80";
      case "logo": return "bg-emerald-500/80";
      case "shape": return "bg-purple-500/80";
      default: return "bg-gray-500/80";
    }
  };

  return (
    <div className="bg-card border-t flex flex-col">
      {/* Transport controls */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => dispatch({ type: "SET_TIME", time: 0 })}
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => dispatch({ type: "SET_PLAYING", playing: !state.isPlaying })}
        >
          {state.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <span className="text-xs font-mono text-muted-foreground min-w-[80px]">
          {formatTime(state.currentTime)} / {formatTime(duration)}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.25"
            value={state.zoom}
            onChange={(e) => dispatch({ type: "SET_ZOOM", zoom: parseFloat(e.target.value) })}
            className="w-20 h-1"
          />
        </div>
      </div>

      {/* Timeline tracks */}
      <div className="flex-1 overflow-auto" ref={timelineRef} onClick={handleTimelineClick}>
        <div className="flex" style={{ minWidth: timelineWidth + HEADER_WIDTH }}>
          {/* Track headers */}
          <div className="flex-shrink-0 border-r bg-muted/20" style={{ width: HEADER_WIDTH }}>
            {/* Ruler header */}
            <div className="h-6 border-b flex items-center px-2">
              <span className="text-[10px] text-muted-foreground font-medium">TEMPS</span>
            </div>
            {/* Video track */}
            <div className="border-b flex items-center px-2 gap-1.5" style={{ height: TRACK_HEIGHT }}>
              <Play className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">Vidéo</span>
            </div>
            {/* Layer tracks */}
            {state.layers.map((layer) => (
              <div
                key={layer.id}
                className={`border-b flex items-center px-2 gap-1 cursor-pointer hover:bg-muted/30 ${
                  state.activeLayerId === layer.id ? "bg-accent/10" : ""
                }`}
                style={{ height: TRACK_HEIGHT }}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "SELECT_LAYER", id: layer.id });
                }}
              >
                {getLayerIcon(layer.type)}
                <span className="text-xs truncate flex-1">{layer.label}</span>
                <button
                  className="opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "UPDATE_LAYER", id: layer.id, updates: { visible: !layer.visible } });
                  }}
                >
                  {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
              </div>
            ))}
            {/* Audio track */}
            {state.audio && (
              <div className="border-b flex items-center px-2 gap-1.5" style={{ height: TRACK_HEIGHT }}>
                <Music className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">Audio</span>
              </div>
            )}
            {/* Business card track */}
            {state.businessCard.enabled && state.businessCard.name && (
              <div className="border-b flex items-center px-2 gap-1.5" style={{ height: TRACK_HEIGHT }}>
                <CreditCard className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">Carte de visite</span>
              </div>
            )}
          </div>

          {/* Track content area */}
          <div className="flex-1 relative">
            {/* Time ruler */}
            <div className="h-6 border-b relative bg-muted/10">
              {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-border/50"
                  style={{ left: i * pixelsPerSecond }}
                >
                  {i % 5 === 0 && (
                    <span className="text-[9px] text-muted-foreground ml-1">{formatTime(i)}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Video track */}
            <div className="border-b relative" style={{ height: TRACK_HEIGHT }}>
              <div
                className="absolute top-1 bottom-1 bg-primary/30 rounded"
                style={{ left: 0, width: duration * pixelsPerSecond }}
              />
            </div>

            {/* Layer tracks */}
            {state.layers.map((layer) => (
              <div key={layer.id} className="border-b relative" style={{ height: TRACK_HEIGHT }}>
                <div
                  className={`absolute top-1 bottom-1 rounded cursor-pointer border border-white/20 flex items-center px-2 ${getLayerColor(
                    layer.type
                  )} ${state.activeLayerId === layer.id ? "ring-1 ring-accent" : ""}`}
                  style={{
                    left: layer.timing.start * pixelsPerSecond,
                    width: (layer.timing.end - layer.timing.start) * pixelsPerSecond,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "SELECT_LAYER", id: layer.id });
                  }}
                >
                  <span className="text-[10px] text-white truncate font-medium">{layer.label}</span>
                </div>
              </div>
            ))}

            {/* Audio track */}
            {state.audio && (
              <div className="border-b relative" style={{ height: TRACK_HEIGHT }}>
                <div
                  className="absolute top-1 bottom-1 bg-amber-500/60 rounded border border-white/20 flex items-center px-2"
                  style={{ left: 0, width: duration * pixelsPerSecond }}
                >
                  <span className="text-[10px] text-white truncate font-medium">
                    {state.audio.fileName}
                  </span>
                </div>
              </div>
            )}

            {/* Business card track */}
            {state.businessCard.enabled && state.businessCard.name && (
              <div className="border-b relative" style={{ height: TRACK_HEIGHT }}>
                <div
                  className="absolute top-1 bottom-1 bg-pink-500/60 rounded border border-white/20 flex items-center px-2"
                  style={{
                    left: Math.max(0, (duration - state.businessCard.duration)) * pixelsPerSecond,
                    width: state.businessCard.duration * pixelsPerSecond,
                  }}
                >
                  <span className="text-[10px] text-white truncate font-medium">Carte de visite</span>
                </div>
              </div>
            )}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20 pointer-events-none"
              style={{ left: state.currentTime * pixelsPerSecond }}
            >
              <div className="w-3 h-3 bg-destructive rounded-full -translate-x-[5px] -translate-y-0.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
