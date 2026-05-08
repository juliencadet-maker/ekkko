import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BlockProps } from "../types";

interface Props extends BlockProps {
  videoSignedUrl: string | null;
  audioSignedUrl: string | null;
  durationMs?: number | null;
  onPlaybackSeconds?: (sec: number) => void;
}

export function HeroVideoBlock({
  videoSignedUrl,
  audioSignedUrl,
  durationMs,
  onPlaybackSeconds,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => onPlaybackSeconds?.(Math.floor(v.currentTime));
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [onPlaybackSeconds]);

  if (!videoSignedUrl && !audioSignedUrl) return null;

  const durationLabel = durationMs
    ? `${Math.floor(durationMs / 60000)}:${String(Math.floor((durationMs % 60000) / 1000)).padStart(2, "0")}`
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/8 bg-foreground shadow-[0_8px_30px_-12px_rgba(13,27,42,0.2)]">
      {videoSignedUrl ? (
        <div className="relative aspect-[16/9]">
          <video
            ref={videoRef}
            src={videoSignedUrl}
            controls
            playsInline
            className="absolute inset-0 h-full w-full bg-black"
          />
          {!playing && durationLabel && (
            <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-background/20 px-2 py-0.5 text-[11px] font-medium text-background backdrop-blur">
              {durationLabel}
            </span>
          )}
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-foreground">
          <audio src={audioSignedUrl!} controls className="w-3/4" />
        </div>
      )}
    </div>
  );
}
