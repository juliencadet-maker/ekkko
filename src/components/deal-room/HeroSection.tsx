import { useEffect, useRef, useState } from "react";
import { Lock, Clock, Eye, ArrowDown } from "lucide-react";
import { V15Payload } from "./types";

interface Props {
  payload: V15Payload;
  greetingFirstName: string | null;
  videoSeconds: number;
  onPlaybackSeconds: (sec: number) => void;
  onVideoStateChange?: (playing: boolean) => void;
  totalBlocks: number;
  viewedCount: number;
}

/**
 * Cinematic hero with sequential fade-in (OOB-1) — eyebrow, title, message, video, meta strip.
 */
export function HeroSection({
  payload,
  greetingFirstName,
  videoSeconds: _videoSeconds,
  onPlaybackSeconds,
  onVideoStateChange,
  totalBlocks,
  viewedCount,
}: Props) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 700);
    const t3 = setTimeout(() => setPhase(3), 1200);
    const t4 = setTimeout(() => setPhase(4), 1800);
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => onPlaybackSeconds(Math.floor(v.currentTime));
    const onPlay = () => { setPlaying(true); onVideoStateChange?.(true); };
    const onPause = () => { setPlaying(false); onVideoStateChange?.(false); };
    const onEnded = () => { setPlaying(false); onVideoStateChange?.(false); };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, [onPlaybackSeconds, onVideoStateChange]);

  const company = payload.company_display_name;
  const fade = (n: number) =>
    `transition-all duration-700 ease-out ${
      phase >= n ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
    }`;

  return (
    <section className="relative overflow-hidden border-b border-foreground/5 bg-card">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            "radial-gradient(1200px 600px at 80% -10%, hsl(var(--accent) / 0.10), transparent 60%), radial-gradient(800px 400px at 0% 100%, hsl(var(--primary) / 0.06), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-[1100px] px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
        <div className={`mb-10 flex items-center gap-4 ${fade(1)}`}>
          {company && (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-[15px] font-semibold text-background">
                {company[0]?.toUpperCase() || "·"}
              </div>
              <div className="h-5 w-px bg-foreground/15" />
            </>
          )}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(var(--accent))] text-[12px] font-bold text-foreground">
              e
            </div>
            <span className="text-[13px] font-medium tracking-tight text-foreground/65">Ekko</span>
          </div>
        </div>

        {company && (
          <p className={`mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-foreground/50 ${fade(1)}`}>
            Espace préparé pour {company}
          </p>
        )}

        <h1
          className={`mb-5 max-w-[820px] font-[Instrument_Serif] text-[44px] font-normal leading-[1.05] tracking-tight text-foreground sm:text-[64px] ${fade(2)}`}
        >
          {greetingFirstName ? <>Bonjour {greetingFirstName},</> : <>Bonjour,</>}
          <br />
          <span className="italic text-foreground/70">tout est là.</span>
        </h1>

        {payload.prospect_message && (
          <p className={`mb-10 max-w-[600px] text-[15px] leading-[1.65] text-foreground/65 sm:text-[17px] ${fade(3)}`}>
            {payload.prospect_message}
          </p>
        )}

        {payload.video_signed_url ? (
          <div className={`group relative mb-8 overflow-hidden rounded-2xl border border-foreground/8 bg-foreground shadow-[0_12px_40px_-12px_rgba(13,27,42,0.25)] ${fade(4)}`}>
            <div className="relative aspect-[16/9] w-full">
              <video
                ref={videoRef}
                src={payload.video_signed_url}
                controls
                playsInline
                className="absolute inset-0 h-full w-full bg-black"
              />
              {!playing && (
                <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between text-background">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.15em] opacity-70">
                      {payload.ae_name || "Votre interlocuteur"}
                    </p>
                    <p className="text-[15px] font-medium opacity-95">Présentation personnelle</p>
                  </div>
                  {payload.video_duration_ms && (
                    <span className="rounded-md bg-background/15 px-2 py-1 text-[11px] font-medium tabular-nums backdrop-blur">
                      {Math.floor(payload.video_duration_ms / 60000)}:
                      {String(Math.floor((payload.video_duration_ms % 60000) / 1000)).padStart(2, "0")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : payload.audio_signed_url ? (
          <div className={`mb-8 rounded-2xl border border-foreground/8 bg-card p-5 ${fade(4)}`}>
            <audio src={payload.audio_signed_url} controls className="w-full" />
          </div>
        ) : null}

        <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] text-foreground/55 ${fade(4)}`}>
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Espace privé</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> lien expirable</span>
          {totalBlocks > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> {viewedCount} / {totalBlocks} sections vues
            </span>
          )}
        </div>

        {totalBlocks > 0 && (
          <a
            href="#deal-room-blocks"
            className={`mt-10 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/55 transition-colors hover:text-foreground ${fade(4)}`}
          >
            Faire défiler <ArrowDown className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </section>
  );
}
