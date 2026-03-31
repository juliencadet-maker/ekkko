import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, ExternalLink, Send, Share2, MessageSquare, ThumbsUp, Heart, Flame, Star, Sparkles, Lock, Mail, UserPlus, Video } from "lucide-react";
import { useVideoEventTracker } from "@/hooks/useVideoEventTracker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";



interface LandingPageConfig {
  logoUrl: string | null;
  brandColor: string;
  ctaText: string;
  ctaUrl: string;
  headline: string;
  subheadline: string;
}

const DEFAULT_CONFIG: LandingPageConfig = {
  logoUrl: null,
  brandColor: "#1e3a5f",
  ctaText: "Prendre rendez-vous",
  ctaUrl: "https://calendly.com",
  headline: "Un message personnalisé pour vous",
  subheadline: "Découvrez notre vidéo exclusive",
};

function generateViewerHash(): string {
  const nav = navigator;
  const raw = [nav.userAgent, nav.language, screen.width, screen.height, new Date().getTimezoneOffset()].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

const EMOJI_REACTIONS = [
  { emoji: "👍", label: "Super" },
  { emoji: "🔥", label: "Excellent" },
  { emoji: "❤️", label: "J'adore" },
  { emoji: "⭐", label: "Top" },
  { emoji: "✨", label: "Génial" },
  { emoji: "🤝", label: "Intéressé" },
];

export default function VideoLandingPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [searchParams] = useSearchParams();
  const referredBy = searchParams.get("ref");

  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<LandingPageConfig>(DEFAULT_CONFIG);
  const [campaignName, setCampaignName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Access gate
  const [isGated, setIsGated] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gateName, setGateName] = useState("");
  const [gateChecking, setGateChecking] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Viewer identity (from gate or form)
  const [viewerName, setViewerName] = useState("");
  const [viewerEmail, setViewerEmail] = useState("");

  // Video ended state
  const [videoEnded, setVideoEnded] = useState(false);

  // Reactions
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [commentSent, setCommentSent] = useState(false);
  const [reactions, setReactions] = useState<{ emoji: string; count: number }[]>([]);

  // Invite dialog
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerHashRef = useRef(generateViewerHash());
  const lastReportedRef = useRef(0);
  const watchSecondsRef = useRef(0);
  const lastSeekFromRef = useRef(0);
  const segmentReplayCountRef = useRef<Record<string, number>>({});

  const { trackEvent } = useVideoEventTracker();

  const baseTrackParams = useCallback(() => ({
    video_id: videoId || "",
    campaign_id: campaignId || "",
    viewer_hash: viewerHashRef.current,
    viewer_email: viewerEmail || undefined,
    viewer_name: viewerName || undefined,
    referred_by_hash: referredBy || undefined,
    referrer: document.referrer || undefined,
  }), [videoId, campaignId, viewerEmail, viewerName, referredBy]);

  useEffect(() => {
    const fetchCampaign = async () => {
      if (!campaignId) {
        setError("Campagne non trouvée");
        setIsLoading(false);
        return;
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        // Fetch campaign via edge function (public access)
        const videoRes = await fetch(`${supabaseUrl}/functions/v1/get-public-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": supabaseKey },
          body: JSON.stringify({ campaign_id: campaignId }),
        });
        const videoData = await videoRes.json();

        if (videoData?.campaign_name) setCampaignName(videoData.campaign_name);
        if (videoData?.landing_page_config) setConfig(videoData.landing_page_config as LandingPageConfig);
        if (videoData?.video_id) setVideoId(videoData.video_id);

        // Check if there's an access list
        const accessRes = await fetch(`${supabaseUrl}/functions/v1/check-video-access`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": supabaseKey },
          body: JSON.stringify({ campaign_id: campaignId, email: "probe@check.access" }),
        });
        const accessData = await accessRes.json();
        
        // If there are restrictions (not "no_restrictions"), show gate
        if (accessData?.reason !== "no_restrictions" && !accessData?.allowed) {
          setIsGated(true);
        } else if (accessData?.reason === "no_restrictions") {
          setAccessGranted(true);
        }

        // Fallback: also try to get campaign name from the response
        if (!videoData?.campaign_name) {
          // Use a separate non-auth call if needed
          const { data } = await supabase
            .from("campaigns")
            .select("name, metadata")
            .eq("id", campaignId)
            .single();
          if (data) {
            setCampaignName(data.name);
            const metadata = data.metadata as Record<string, unknown> | null;
            if (metadata?.landingPageConfig) {
              setConfig(metadata.landingPageConfig as LandingPageConfig);
            }
          }
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Cette page n'existe pas ou n'est plus disponible");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId]);

  const handleGateSubmit = async () => {
    if (!gateEmail.trim() || !gateName.trim()) {
      setGateError("Veuillez renseigner votre nom et email");
      return;
    }

    setGateChecking(true);
    setGateError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/check-video-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": supabaseKey },
        body: JSON.stringify({ campaign_id: campaignId, email: gateEmail.trim() }),
      });
      const data = await res.json();

      if (data?.allowed) {
        setAccessGranted(true);
        setViewerName(gateName.trim());
        setViewerEmail(gateEmail.trim());
        // Also report this viewer to watch progress
        reportProgress(0);
      } else {
        setGateError("Votre adresse email n'est pas autorisée à voir cette vidéo. Vérifiez avec l'expéditeur.");
      }
    } catch {
      setGateError("Erreur de vérification, veuillez réessayer");
    } finally {
      setGateChecking(false);
    }
  };

  const reportProgress = useCallback(async (percentage: number) => {
    if (!videoId) return;
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${supabaseUrl}/functions/v1/track-watch-progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          video_id: videoId,
          viewer_hash: viewerHashRef.current,
          watch_percentage: Math.round(percentage),
          total_watch_seconds: Math.round(watchSecondsRef.current),
          viewer_name: viewerName || undefined,
          viewer_email: viewerEmail || undefined,
          referred_by_hash: referredBy || undefined,
        }),
      });
    } catch {
      // silent
    }
  }, [videoId, referredBy, viewerName, viewerEmail]);

  // Track video progress + granular events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoId) return;

    // page_landed event on mount
    trackEvent({ ...baseTrackParams(), event_type: "page_landed", event_data: { referrer: document.referrer } });

    const onPlay = () => {
      if (video.currentTime < 1) {
        trackEvent({ ...baseTrackParams(), event_type: "video_started", position_sec: 0, event_data: { autoplay: false } });
      }
    };

    const onTimeUpdate = () => {
      if (!video.duration) return;
      const percentage = (video.currentTime / video.duration) * 100;
      watchSecondsRef.current = video.currentTime;
      const rounded = Math.floor(percentage / 10) * 10;
      if (rounded > lastReportedRef.current) {
        lastReportedRef.current = rounded;
        reportProgress(percentage);
        trackEvent({ ...baseTrackParams(), event_type: "watch_progress", position_sec: video.currentTime, event_data: { percent: Math.round(percentage), elapsed_sec: Math.round(video.currentTime) } });
      }
    };

    const onPause = () => {
      if (!video.ended) {
        trackEvent({ ...baseTrackParams(), event_type: "video_paused", position_sec: video.currentTime, event_data: { duration_sec: video.duration } });
      }
    };

    const onSeeking = () => {
      lastSeekFromRef.current = video.currentTime;
    };

    const onSeeked = () => {
      const from = lastSeekFromRef.current;
      const to = video.currentTime;
      const direction = to < from ? "backward" : "forward";
      trackEvent({ ...baseTrackParams(), event_type: "video_seeked", position_sec: to, event_data: { from_sec: Math.round(from), to_sec: Math.round(to), direction } });

      // Detect segment replay (backward seek)
      if (direction === "backward") {
        const segKey = `${Math.floor(to / 10) * 10}`;
        segmentReplayCountRef.current[segKey] = (segmentReplayCountRef.current[segKey] || 0) + 1;
        if (segmentReplayCountRef.current[segKey] >= 2) {
          trackEvent({ ...baseTrackParams(), event_type: "segment_replayed", position_sec: to, event_data: { segment_start: Math.floor(to / 10) * 10, segment_end: Math.floor(to / 10) * 10 + 10, replay_count: segmentReplayCountRef.current[segKey] } });
        }
      }
    };

    const onEnded = () => {
      reportProgress(100);
      setVideoEnded(true);
      trackEvent({ ...baseTrackParams(), event_type: "video_completed", position_sec: video.duration, event_data: { total_watch_pct: 100, total_time_sec: Math.round(video.duration) } });
    };

    const onRateChange = () => {
      trackEvent({ ...baseTrackParams(), event_type: "speed_changed", position_sec: video.currentTime, event_data: { to_speed: video.playbackRate } });
    };

    const onFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      trackEvent({ ...baseTrackParams(), event_type: "fullscreen_toggled", position_sec: video.currentTime, event_data: { direction: isFullscreen ? "enter" : "exit" } });
    };

    const onVisibilityChange = () => {
      trackEvent({ ...baseTrackParams(), event_type: "tab_visibility_changed", position_sec: video.currentTime, event_data: { state: document.hidden ? "hidden" : "visible" } });
    };

    const onBeforeUnload = () => {
      const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
      if (pct > 0 && pct < 90) {
        trackEvent({ ...baseTrackParams(), event_type: "video_dropped", position_sec: video.currentTime, event_data: { drop_pct: Math.round(pct), drop_position_sec: Math.round(video.currentTime) } });
      }
      trackEvent({ ...baseTrackParams(), event_type: "page_exit", event_data: { last_action: "unload" } });
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ended", onEnded);
    video.addEventListener("ratechange", onRateChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("ratechange", onRateChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [videoId, reportProgress, trackEvent, baseTrackParams]);

  const handleVideoToggle = () => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) video.pause();
      else video.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleEmojiReaction = async (emoji: string) => {
    if (!videoId || !campaignId) return;
    setSelectedEmoji(emoji);
    trackEvent({ ...baseTrackParams(), event_type: "reaction_added", event_data: { reaction_type: emoji } });
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${supabaseUrl}/functions/v1/submit-video-reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": supabaseKey },
        body: JSON.stringify({
          video_id: videoId,
          campaign_id: campaignId,
          viewer_hash: viewerHashRef.current,
          viewer_name: viewerName || undefined,
          viewer_email: viewerEmail || undefined,
          reaction_type: "emoji",
          emoji,
        }),
      });
      toast.success("Merci pour votre réaction !");
    } catch {
      toast.error("Erreur, veuillez réessayer");
    }
  };

  const handleCommentSubmit = async () => {
    if (!comment.trim() || !videoId || !campaignId) return;
    trackEvent({ ...baseTrackParams(), event_type: "comment_submitted", event_data: { comment_text: comment.trim() } });
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${supabaseUrl}/functions/v1/submit-video-reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": supabaseKey },
        body: JSON.stringify({
          video_id: videoId,
          campaign_id: campaignId,
          viewer_hash: viewerHashRef.current,
          viewer_name: viewerName || undefined,
          viewer_email: viewerEmail || undefined,
          reaction_type: "comment",
          comment: comment.trim(),
        }),
      });
      setCommentSent(true);
      setComment("");
      toast.success("Commentaire envoyé !");
    } catch {
      toast.error("Erreur, veuillez réessayer");
    }
  };

  const handleInviteSend = async () => {
    if (!inviteEmail.trim() || !inviteName.trim() || !videoId || !campaignId) {
      toast.error("Veuillez remplir nom et email");
      return;
    }
    setInviteSending(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${supabaseUrl}/functions/v1/send-share-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          video_id: videoId,
          campaign_id: campaignId,
          sender_name: viewerName || "Un collaborateur",
          sender_viewer_hash: viewerHashRef.current,
          collaborators: [{
            first_name: inviteName.split(" ")[0]?.trim() || inviteName.trim(),
            last_name: inviteName.split(" ").slice(1).join(" ")?.trim() || "",
            email: inviteEmail.trim(),
          }],
        }),
      });
      trackEvent({ ...baseTrackParams(), event_type: "page_shared", event_data: { share_method: "invite_dialog", recipient_hint: inviteEmail.trim() } });
      toast.success(`Invitation envoyée à ${inviteName}`);
      setShowInviteDialog(false);
      setInviteName("");
      setInviteEmail("");
    } catch {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setInviteSending(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Page introuvable</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Access gate
  if (isGated && !accessGranted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: config.brandColor + "08" }}>
        <header className="py-4 px-6 flex items-center justify-center shadow-sm" style={{ backgroundColor: config.brandColor }}>
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" className="h-10 max-w-[200px] object-contain brightness-0 invert" />
          ) : (
            <div className="h-10 flex items-center text-white font-bold text-xl">{campaignName}</div>
          )}
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardContent className="pt-8 pb-6 px-6 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: config.brandColor + "15" }}>
                <Lock className="h-8 w-8" style={{ color: config.brandColor }} />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2" style={{ color: config.brandColor }}>
                  {config.headline}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Pour accéder à cette vidéo, veuillez vous identifier.
                </p>
              </div>
              <div className="space-y-3 text-left">
                <Input
                  placeholder="Votre nom complet"
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGateSubmit()}
                />
                <Input
                  placeholder="Votre adresse email professionnelle"
                  type="email"
                  value={gateEmail}
                  onChange={(e) => setGateEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGateSubmit()}
                />
                {gateError && (
                  <p className="text-sm text-destructive">{gateError}</p>
                )}
                <Button
                  className="w-full"
                  style={{ backgroundColor: config.brandColor }}
                  onClick={handleGateSubmit}
                  disabled={gateChecking}
                >
                  {gateChecking ? "Vérification..." : "Accéder à la vidéo"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>

        <footer className="py-4 px-6 text-center">
          <p className="text-xs text-muted-foreground">
            Cette vidéo a été générée par IA •
            <a href="/" className="ml-1 hover:underline" style={{ color: config.brandColor }}>Propulsé par Ekko</a>
          </p>
        </footer>
      </div>
    );
  }

  // Main landing page
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: config.brandColor + "08" }}>
      {/* Header */}
      <header className="py-3 md:py-4 px-4 md:px-6 flex items-center justify-between shadow-sm" style={{ backgroundColor: config.brandColor }}>
        <div className="flex items-center">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" className="h-8 md:h-10 max-w-[160px] md:max-w-[200px] object-contain brightness-0 invert" />
          ) : (
            <div className="h-8 md:h-10 flex items-center text-white font-bold text-lg md:text-xl">{campaignName}</div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5"
          onClick={() => setShowInviteDialog(true)}
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Inviter un collègue</span>
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 md:py-12">
        <div className="w-full max-w-3xl mx-auto text-center">
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-2 md:mb-3" style={{ color: config.brandColor }}>
            {config.headline}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8">
            {config.subheadline}
          </p>

          {/* Video Player */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl mb-6 md:mb-8">
            <video
              ref={videoRef}
              src={MOCK_VIDEO_URL}
              className="w-full h-full object-cover"
              poster="/placeholder.svg"
              onPlay={() => { setIsPlaying(true); setVideoEnded(false); }}
              onPause={() => setIsPlaying(false)}
              onEnded={() => { setIsPlaying(false); setVideoEnded(true); }}
              playsInline
            />

            {/* Play/Pause overlay */}
            {!videoEnded && (
              <div
                className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity cursor-pointer ${
                  isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"
                }`}
                onClick={handleVideoToggle}
              >
                <div
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: config.brandColor }}
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8 md:h-10 md:w-10 text-white" />
                  ) : (
                    <Play className="h-8 w-8 md:h-10 md:w-10 text-white ml-1" />
                  )}
                </div>
              </div>
            )}

            {/* End overlay with reactions */}
            {videoEnded && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-500">
                <p className="text-white text-lg md:text-xl font-semibold mb-4 md:mb-6">
                  Qu'avez-vous pensé de cette vidéo ?
                </p>

                {/* Emoji reactions */}
                <div className="flex flex-wrap gap-2 md:gap-3 justify-center mb-4 md:mb-6">
                  {EMOJI_REACTIONS.map(({ emoji, label }) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiReaction(emoji)}
                      className={`flex flex-col items-center gap-1 p-2 md:p-3 rounded-xl transition-all hover:scale-110 ${
                        selectedEmoji === emoji
                          ? "bg-white/30 scale-110"
                          : "bg-white/10 hover:bg-white/20"
                      }`}
                    >
                      <span className="text-2xl md:text-3xl">{emoji}</span>
                      <span className="text-[10px] md:text-xs text-white/70">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Comment */}
                {!commentSent ? (
                  <div className="w-full max-w-sm flex gap-2">
                    <Input
                      placeholder="Laisser un petit mot..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit()}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    />
                    <Button
                      size="icon"
                      onClick={handleCommentSubmit}
                      disabled={!comment.trim()}
                      style={{ backgroundColor: config.brandColor }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-white/60 text-sm">✓ Commentaire envoyé</p>
                )}

                {/* Replay + invite */}
                <div className="flex gap-3 mt-4 md:mt-6">
                  <Button
                    variant="outline"
                    className="text-white border-white/30 hover:bg-white/10 gap-2"
                    onClick={() => {
                      const video = videoRef.current;
                      if (video) {
                        video.currentTime = 0;
                        video.play();
                        setVideoEnded(false);
                      }
                    }}
                  >
                    <Play className="h-4 w-4" />
                    Revoir
                  </Button>
                  <Button
                    variant="outline"
                    className="text-white border-white/30 hover:bg-white/10 gap-2"
                    onClick={() => setShowInviteDialog(true)}
                  >
                    <Share2 className="h-4 w-4" />
                    Partager
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* CTA + Share */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
            <Button
              variant="outline"
              className="gap-2 border-2"
              style={{ borderColor: config.brandColor, color: config.brandColor }}
              onClick={() => setShowInviteDialog(true)}
            >
              <Share2 className="h-4 w-4" />
              Partager à un collègue
            </Button>
            <Button
              size="lg"
              className="px-6 md:px-8 py-5 md:py-6 text-base md:text-lg font-semibold rounded-xl transition-transform hover:scale-105"
              style={{ backgroundColor: config.brandColor, color: "white" }}
              onClick={() => { trackEvent({ ...baseTrackParams(), event_type: "cta_clicked", event_data: { cta_type: config.ctaText, position_in_page: "main" } }); window.open(config.ctaUrl, "_blank"); }}
            >
              {config.ctaText}
              <ExternalLink className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 md:py-4 px-4 md:px-6 text-center">
        <p className="text-xs text-muted-foreground">
          Cette vidéo a été générée par IA •
          <a href="/" className="ml-1 hover:underline" style={{ color: config.brandColor }}>Propulsé par Ekko</a>
        </p>
      </footer>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Inviter un collègue
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Partagez cette vidéo avec un collègue pour qu'il puisse la visionner.
            </p>
            <Input
              placeholder="Nom du collègue"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
            <Input
              placeholder="Email professionnel"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInviteSend()}
            />
            <Button
              className="w-full gap-2"
              style={{ backgroundColor: config.brandColor }}
              onClick={handleInviteSend}
              disabled={inviteSending}
            >
              <Send className="h-4 w-4" />
              {inviteSending ? "Envoi..." : "Envoyer l'invitation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
