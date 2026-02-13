import { useRef, useEffect, useCallback } from "react";
import { useEditor } from "./EditorContext";

export function EditorPreview() {
  const { state, dispatch, isLayerVisible } = useEditor();
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number>();

  const syncTime = useCallback(() => {
    if (videoRef.current && state.isPlaying) {
      dispatch({ type: "SET_TIME", time: videoRef.current.currentTime });
      animationRef.current = requestAnimationFrame(syncTime);
    }
  }, [state.isPlaying, dispatch]);

  useEffect(() => {
    if (state.isPlaying) {
      videoRef.current?.play();
      animationRef.current = requestAnimationFrame(syncTime);
    } else {
      videoRef.current?.pause();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [state.isPlaying, syncTime]);

  useEffect(() => {
    if (videoRef.current && !state.isPlaying) {
      videoRef.current.currentTime = state.currentTime;
    }
  }, [state.currentTime, state.isPlaying]);

  const handleVideoEnd = () => {
    dispatch({ type: "SET_PLAYING", playing: false });
    dispatch({ type: "SET_TIME", time: 0 });
  };

  const getAnimationClass = (animation?: string) => {
    switch (animation) {
      case "fadeIn": return "animate-fade-in";
      case "slideUp": return "animate-slide-up";
      case "slideLeft": return "animate-editor-slide-left";
      case "typewriter": return "animate-editor-typewriter";
      default: return "";
    }
  };

  const showBusinessCard =
    state.businessCard.enabled &&
    state.videoDuration > 0 &&
    state.currentTime >= state.videoDuration - state.businessCard.duration;

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-xl">
      {state.videoUrl ? (
        <video
          ref={videoRef}
          src={state.videoUrl}
          className="w-full h-full object-contain"
          onLoadedMetadata={(e) => {
            const dur = (e.target as HTMLVideoElement).duration;
            dispatch({ type: "SET_VIDEO", url: state.videoUrl, duration: dur });
          }}
          onEnded={handleVideoEnd}
          muted={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Aucune vidéo chargée</p>
        </div>
      )}

      {/* Overlay layers */}
      {state.layers.map((layer) => {
        if (!isLayerVisible(layer)) return null;
        const s = layer.style;

        return (
          <div
            key={layer.id}
            className={`absolute cursor-pointer transition-all ${getAnimationClass(s.animation)} ${
              state.activeLayerId === layer.id ? "ring-2 ring-accent" : ""
            }`}
            style={{
              left: `${layer.position.x}%`,
              top: `${layer.position.y}%`,
              width: `${layer.size.width}%`,
              fontSize: `${(s.fontSize || 16) * 0.5}px`,
              fontFamily: s.fontFamily,
              fontWeight: s.fontWeight,
              color: s.color,
              backgroundColor: s.backgroundColor,
              opacity: s.opacity ?? 1,
              borderRadius: s.borderRadius ? `${s.borderRadius}px` : undefined,
              padding: s.padding ? `${s.padding * 0.5}px` : undefined,
              textAlign: s.textAlign,
              letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined,
              lineHeight: s.lineHeight || undefined,
              textShadow: s.textShadow,
            }}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "SELECT_LAYER", id: layer.id });
            }}
          >
            {layer.type === "logo" ? (
              <img
                src={layer.content}
                alt="Logo"
                className="max-w-full max-h-full object-contain"
                style={{ opacity: s.opacity ?? 1 }}
              />
            ) : (
              <span className="whitespace-pre-wrap">{layer.content}</span>
            )}
          </div>
        );
      })}

      {/* Business Card Overlay */}
      {showBusinessCard && state.businessCard.name && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 animate-fade-in">
          <BusinessCardDisplay config={state.businessCard} />
        </div>
      )}
    </div>
  );
}

function BusinessCardDisplay({ config }: { config: import("./types").BusinessCardConfig }) {
  const styleClasses: Record<string, string> = {
    minimal: "bg-white/95 text-gray-900 rounded-lg p-8 max-w-md",
    corporate: "bg-gradient-to-br from-[#1a2744] to-[#2a3f6f] text-white rounded-xl p-8 max-w-md shadow-2xl",
    modern: "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl p-8 max-w-md shadow-2xl",
    bold: "bg-red-600 text-white p-8 max-w-md",
  };

  return (
    <div className={styleClasses[config.style] || styleClasses.corporate}>
      <div className="flex items-center gap-4">
        {config.photoUrl && (
          <img
            src={config.photoUrl}
            alt={config.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-white/30"
          />
        )}
        <div className="flex-1">
          <h3 className="text-xl font-bold">{config.name}</h3>
          {config.title && <p className="text-sm opacity-80">{config.title}</p>}
        </div>
        {config.logoUrl && (
          <img
            src={config.logoUrl}
            alt="Logo"
            className="h-10 object-contain opacity-80"
          />
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap gap-4 text-sm opacity-90">
        {config.email && <span>{config.email}</span>}
        {config.phone && <span>{config.phone}</span>}
      </div>
    </div>
  );
}
