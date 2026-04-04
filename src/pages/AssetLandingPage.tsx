import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, ExternalLink, Send, Share2, UserPlus, ChevronRight } from "lucide-react";
import { useVideoEventTracker } from "@/hooks/useVideoEventTracker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { EkkoLoader } from "@/components/ui/EkkoLoader";
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
  brandColor: "#0D1B2A",
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

const TOPIC_LABELS: Record<string, string> = {
  pricing: "Budget et ROI",
  technical: "Intégration technique",
  deployment: "Déploiement",
  governance: "Sécurité et gouvernance",
};

const LAYER_LABELS: Record<string, string> = {
  financial: "Finance",
  executive: "Direction",
  technical: "Technique",
  operational: "Opérations",
  procurement: "Achats",
  legal: "Juridique",
};

const layerTopicMap: Record<string, string> = {
  financial: "pricing",
  executive: "pricing",
  technical: "technical",
  operational: "deployment",
  procurement: "pricing",
  legal: "governance",
};

export default function AssetLandingPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [searchParams] = useSearchParams();
  const referredBy = searchParams.get("ref");
  const isPreviewMode = searchParams.get("preview") === "true";

  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<LandingPageConfig>(DEFAULT_CONFIG);
  const [campaignName, setCampaignName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Access gate (states conservés, gate UI supprimée en D1b)
  const [isGated, setIsGated] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);

  // Viewer identity
  const [viewerName, setViewerName] = useState("");
  const [viewerEmail, setViewerEmail] = useState("");

  // Video ended state
  const [videoEnded, setVideoEnded] = useState(false);

  // Comment
  const [comment, setComment] = useState("");
  const [commentSent, setCommentSent] = useState(false);

  // Invite dialog
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  // ─── D1 states ───
  const [assetType, setAssetType] = useState<"video" | "document" | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [versionNumber, setVersionNumber] = useState<number | null>(null);
  const [isReplacedByNewerVersion] = useState(false);
  const [aeInitials, setAeInitials] = useState("");
  const [aeName, setAeName] = useState("");
  const [prospectMessage, setProspectMessage] = useState("");
  const [summaryBullets, setSummaryBullets] = useState<string[]>([]);
  const [contextBullets, setContextBullets] = useState<string[]>([]);
  const [secondaryAssets, setSecondaryAssets] = useState<any[]>([]);
  const [experienceMode, setExperienceMode] = useState<"simple" | "deal_room">("deal_room");
  const [scanMode, setScanMode] = useState(false);
  const [engagementLevel, setEngagementLevel] = useState(0);
  const [hasBeenSeen, setHasBeenSeen] = useState(false);
  const [level1Visible, setLevel1Visible] = useState(false);
  const [level1Answer, setLevel1Answer] = useState<string | null>(null);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [activeSecondaryAsset, setActiveSecondaryAsset] = useState<any | null>(null);
  const [newAssets, setNewAssets] = useState<any[]>([]);

  // ─── D2 states — Document tracking ───
  const [assetId, setAssetId] = useState<string | null>(null);
  const docOpenedRef = useRef(false);
  const docTimeCounterRef = useRef(0);
  const docTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const docOpenedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── D1b states — Identification ───
  const [identificationStep, setIdentificationStep] = useState<"who" | "topics" | "done">("who");
  const [identifiedViewer, setIdentifiedViewer] = useState<{
    id: string; name: string; title?: string | null; email?: string | null;
  } | null>(null);
  const [knownContacts, setKnownContacts] = useState<{
    id: string; name: string; title?: string | null; layer?: string | null;
  }[]>([]);
  const [showSelfRegister, setShowSelfRegister] = useState(false);
  const [selfRegisterName, setSelfRegisterName] = useState("");
  const [selfRegisterEmail, setSelfRegisterEmail] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [suggestedTopic, setSuggestedTopic] = useState<string | null>(null);
  const [topicsEnabled, setTopicsEnabled] = useState<string[]>(
    ["pricing", "technical", "deployment", "governance"]
  );

  const signalCooldownRef = useRef<Record<string, number>>({});
  const level1TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ─── Signal handler ───
  const handleSignal = useCallback(async (
    event_type: string, event_layer: string, event_data: Record<string, unknown>
  ) => {
    if (isPreviewMode || !campaignId) return;
    if (event_layer !== "declared") {
      const lastSent = signalCooldownRef.current[event_type] || 0;
      if (Date.now() - lastSent < 10000) return;
    }
    signalCooldownRef.current[event_type] = Date.now();
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${url}/functions/v1/prospect-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": key },
        body: JSON.stringify({ campaign_id: campaignId, event_type, event_layer, event_data }),
      });
    } catch { /* silent */ }
  }, [isPreviewMode, campaignId]);

  // ─── Engagement level update ───
  const updateLevel = useCallback((level: number) => {
    setEngagementLevel(prev => {
      const next = Math.max(prev, level);
      if (!isPreviewMode && campaignId) {
        try {
          const key = `ekko_deal_${campaignId}`;
          const existing = JSON.parse(localStorage.getItem(key) || "{}");
          localStorage.setItem(key, JSON.stringify({
            ...existing,
            seen: true,
            engagementLevel: next,
            lastVisit: new Date().toISOString(),
          }));
        } catch { /* silent */ }
      }
      return next;
    });
  }, [isPreviewMode, campaignId]);

  // ─── localStorage init ───
  useEffect(() => {
    if (!campaignId) return;
    const key = `ekko_deal_${campaignId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        setHasBeenSeen(true);
        setEngagementLevel(data.engagementLevel || 0);
        if (data.lastVisit && !isPreviewMode) {
          const diff = Date.now() - new Date(data.lastVisit).getTime();
          if (diff > 60 * 60 * 1000) {
            handleSignal("engagement_signal", "fact", { signal: "re_engagement" });
          }
        }
      }
    } catch { /* silent */ }
  }, [campaignId, isPreviewMode, handleSignal]);

  // Cleanup level1 timer
  useEffect(() => () => {
    if (level1TimerRef.current) clearTimeout(level1TimerRef.current);
  }, []);

  // ─── Fetch campaign data ───
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

        const videoRes = await fetch(`${supabaseUrl}/functions/v1/get-public-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": supabaseKey },
          body: JSON.stringify({
            campaign_id: campaignId,
            viewer_hash: referredBy || undefined,
          }),
        });
        const videoData = await videoRes.json();

        if (videoData?.campaign_name) setCampaignName(videoData.campaign_name);
        if (videoData?.video_id) setVideoId(videoData.video_id);
        if (videoData?.asset_type) setAssetType(videoData.asset_type);
        if (videoData?.file_url) setFileUrl(videoData.file_url);
        if (videoData?.version_number) setVersionNumber(videoData.version_number);
        if (videoData?.ae_name) setAeName(videoData.ae_name);
        if (videoData?.ae_initials) setAeInitials(videoData.ae_initials);
        if (videoData?.prospect_message) setProspectMessage(videoData.prospect_message);
        if (videoData?.summary_bullets) setSummaryBullets(videoData.summary_bullets);
        if (videoData?.context_bullets) setContextBullets(videoData.context_bullets);
        if (videoData?.secondary_assets) setSecondaryAssets(videoData.secondary_assets);
        if (videoData?.asset_id) setAssetId(videoData.asset_id);
        if (videoData?.experience_mode) setExperienceMode(videoData.experience_mode as "simple" | "deal_room");

        // D1b: known_contacts + topics
        if (videoData?.known_contacts?.length > 0) {
          setKnownContacts(videoData.known_contacts);
        }
        const rawTopics = videoData?.topics_enabled;
        if (rawTopics && rawTopics.length > 0) {
          setTopicsEnabled(rawTopics);
        }

        // D1b: Resolve token (couche 1)
        if (videoData?.resolved_viewer) {
          const rv = videoData.resolved_viewer;
          setIdentifiedViewer(rv);
          setViewerName(rv.name || "");
          if (rv.email) setViewerEmail(rv.email);
          if (rv.layer) {
            const suggested = layerTopicMap[rv.layer] || null;
            if (suggested) setSuggestedTopic(suggested);
          }
          handleSignal("engagement_signal", "declared", {
            signal: "identity_confirmed",
            viewer_id: rv.id,
            source: "token",
          });
          setIdentificationStep("topics");
        } else if ((videoData?.known_contacts || []).length > 0) {
          setIdentificationStep("who");
        } else {
          setIdentificationStep("topics");
        }

        // Resolve video URL from video_id via storage_path
        if (videoData?.video_id) {
          const { data: vid } = await supabase
            .from("videos")
            .select("storage_path")
            .eq("id", videoData.video_id)
            .maybeSingle();
          if (vid?.storage_path) {
            const { data: signedData } = await supabase.storage
              .from("generated_videos")
              .createSignedUrl(vid.storage_path, 3600);
            if (signedData?.signedUrl) setVideoUrl(signedData.signedUrl);
          }
        }

        // Landing page config from metadata
        if (videoData?.landing_page_config) setConfig(videoData.landing_page_config as LandingPageConfig);

        // localStorage: écrire + détecter nouveaux assets
        if (!isPreviewMode) {
          try {
            const key = `ekko_deal_${campaignId}`;
            const raw = localStorage.getItem(key);
            const existing = raw ? JSON.parse(raw) : {};
            const currentAssetIds = (videoData?.secondary_assets || []).map((a: any) => a.id);
            if (existing.knownAssetIds?.length && videoData?.secondary_assets?.length) {
              const freshAssets = (videoData.secondary_assets as any[]).filter(
                (a: any) => !existing.knownAssetIds.includes(a.id)
              );
              if (freshAssets.length > 0) setNewAssets(freshAssets);
            }
            localStorage.setItem(key, JSON.stringify({
              ...existing,
              seen: true,
              lastVisit: new Date().toISOString(),
              knownAssetIds: currentAssetIds,
            }));
          } catch { /* silent */ }
        }

        // Access gate check
        const accessRes = await fetch(`${supabaseUrl}/functions/v1/check-video-access`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": supabaseKey },
          body: JSON.stringify({ campaign_id: campaignId, email: "probe@check.access" }),
        });
        const accessData = await accessRes.json();
        if (accessData?.reason !== "no_restrictions" && !accessData?.allowed) {
          setIsGated(true);
        } else if (accessData?.reason === "no_restrictions") {
          setAccessGranted(true);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Cette page n'existe pas ou n'est plus disponible");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId, isPreviewMode, referredBy]);

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
    } catch { /* silent */ }
  }, [videoId, referredBy, viewerName, viewerEmail]);

  // ─── D2: trackDocEvent helper ───
  const trackDocEvent = useCallback(async (
    event_type: string,
    extra: Record<string, unknown> = {}
  ) => {
    if (isPreviewMode || !campaignId || !assetId || assetType !== "document") return;
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${url}/functions/v1/track-document-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": key },
        body: JSON.stringify({
          asset_id: assetId,
          campaign_id: campaignId,
          viewer_hash: viewerHashRef.current,
          event_type,
          viewer_name: viewerName || undefined,
          referred_by_hash: referredBy || undefined,
          ...extra,
        }),
      });
    } catch { /* silent */ }
  }, [isPreviewMode, campaignId, assetId, assetType, viewerName, referredBy]);

  // ─── D2: Document tracking useEffect ───
  useEffect(() => {
    if (assetType !== "document" || !assetId || identificationStep !== "done") return;

    // doc_return_visit
    const storedHash = localStorage.getItem(`ekko_viewer_hash_${campaignId}`);
    const currentHash = viewerHashRef.current.toString();
    const isKnownDevice = storedHash === currentHash;
    if (hasBeenSeen && isKnownDevice) {
      trackDocEvent("doc_return_visit", {});
    }
    localStorage.setItem(`ekko_viewer_hash_${campaignId}`, currentHash);

    // doc_opened after 5s
    docOpenedTimerRef.current = setTimeout(() => {
      if (!docOpenedRef.current) {
        docOpenedRef.current = true;
        trackDocEvent("doc_opened", { time_spent_seconds: 5 });
      }
    }, 5000);

    // doc_time_on_page every 30s — cap 15 min
    const MAX_DOC_TIME = 900;
    docTimerRef.current = setInterval(() => {
      if (docTimeCounterRef.current >= MAX_DOC_TIME) {
        if (docTimerRef.current) clearInterval(docTimerRef.current);
        return;
      }
      docTimeCounterRef.current += 30;
      trackDocEvent("doc_time_on_page", {
        time_spent_seconds: docTimeCounterRef.current,
      });
    }, 30000);

    // Visibility change — pause/resume timers
    const handleVisibility = () => {
      if (document.hidden) {
        if (docTimerRef.current) {
          clearInterval(docTimerRef.current);
          docTimerRef.current = null;
        }
      } else if (assetType === "document" && !docTimerRef.current) {
        docTimerRef.current = setInterval(() => {
          if (document.hidden) return;
          if (docTimeCounterRef.current >= MAX_DOC_TIME) {
            if (docTimerRef.current) clearInterval(docTimerRef.current);
            return;
          }
          docTimeCounterRef.current += 30;
          trackDocEvent("doc_time_on_page", {
            time_spent_seconds: docTimeCounterRef.current,
          });
        }, 30000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (docOpenedTimerRef.current) clearTimeout(docOpenedTimerRef.current);
      if (docTimerRef.current) clearInterval(docTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (!docOpenedRef.current && docTimeCounterRef.current > 1) {
        trackDocEvent("doc_closed_without_read", {
          time_spent_seconds: docTimeCounterRef.current,
        });
      }
    };
  }, [assetType, assetId, identificationStep, hasBeenSeen, trackDocEvent, campaignId]);

  // Track video progress + granular events — INTACT
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoId) return;

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

      // D1: Engagement levels from video progress
      if (video.currentTime >= 30 && engagementLevel < 1) {
        updateLevel(1);
        setLevel1Visible(true);
        level1TimerRef.current = setTimeout(() => {
          setLevel1Visible(false);
          if (!level1Answer) setLevel1Answer("ignored");
        }, 15000);
      }
      if (percentage >= 60 && engagementLevel < 2) {
        updateLevel(2);
        handleSignal("engagement_signal", "fact", { signal: "deep_engagement", threshold: 60 });
      }
    };

    const onPause = () => {
      if (!video.ended) {
        trackEvent({ ...baseTrackParams(), event_type: "video_paused", position_sec: video.currentTime, event_data: { duration_sec: video.duration } });
      }
    };

    const onSeeking = () => { lastSeekFromRef.current = video.currentTime; };

    const onSeeked = () => {
      const from = lastSeekFromRef.current;
      const to = video.currentTime;
      const direction = to < from ? "backward" : "forward";
      trackEvent({ ...baseTrackParams(), event_type: "video_seeked", position_sec: to, event_data: { from_sec: Math.round(from), to_sec: Math.round(to), direction } });
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
      updateLevel(3);
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
  }, [videoId, reportProgress, trackEvent, baseTrackParams, engagementLevel, level1Answer, updateLevel, handleSignal]);

  const handleVideoToggle = () => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) video.pause();
      else video.play();
      setIsPlaying(!isPlaying);
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

  // ─── D1 handlers ───
  const handleLevel1 = (answer: "yes" | "no") => {
    setLevel1Answer(answer);
    setLevel1Visible(false);
    if (level1TimerRef.current) clearTimeout(level1TimerRef.current);
    handleSignal("engagement_signal", "declared", {
      signal: answer === "yes" ? "early_engagement" : "friction_early",
      level: 1,
    });
    if (answer === "no") setShowFeedbackInput(true);
  };

  const handleSecondaryAssetClick = (asset: any) => {
    const signalMap: Record<string, string> = {
      pricing: "pricing_interest",
      technical: "technical_interest",
      intro: "early_engagement",
      closing: "intent_to_move",
    };
    handleSignal("asset_click", "fact", {
      signal: signalMap[asset.asset_purpose] || "asset_click",
      asset_purpose: asset.asset_purpose,
    });
    setActiveSecondaryAsset(asset);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) return;
    await handleSignal("prospect_feedback", "declared", {
      response: "clarification",
      text: feedbackText.trim().slice(0, 300),
    });
    setFeedbackSent(true);
    setShowFeedbackInput(false);
    setFeedbackText("");
  };

  // ─── D1b handlers — Identification ───
  const handleSelectContact = (contact: typeof knownContacts[0]) => {
    setIdentifiedViewer(contact);
    setViewerName(contact.name);
    setSuggestedTopic(null);
    const suggested = layerTopicMap[contact.layer || ""] || null;
    if (suggested) setSuggestedTopic(suggested);
    handleSignal("engagement_signal", "declared", {
      signal: "identity_confirmed",
      viewer_id: contact.id,
      source: "who_are_you",
    });
    setIdentificationStep("topics");
  };

  const handleSelfRegister = () => {
    if (!selfRegisterName.trim() || !selfRegisterEmail.trim()) return;
    setViewerName(selfRegisterName.trim());
    setViewerEmail(selfRegisterEmail.trim());
    setIdentifiedViewer({ id: null as any, name: selfRegisterName.trim() });
    handleSignal("prospect_feedback", "fact", {
      response: "new_contact_identified",
      name: selfRegisterName.trim(),
      email: selfRegisterEmail.trim(),
      source: "self_register",
    });
    setIdentificationStep("topics");
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  const handleTopicsSubmit = () => {
    if (selectedTopics.length > 0) {
      handleSignal("prospect_feedback", "declared", {
        response: "topic_selection",
        topics: selectedTopics,
        viewer_id: (identifiedViewer?.id && identifiedViewer.id !== "PENDING")
          ? identifiedViewer.id : null,
      });
    }
    setIdentificationStep("done");
  };

  // ─── Render helpers ───
  const renderAssetZone = () => {
    if (assetType === "video" || assetType === null) {
      return (
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-lg mx-0 mb-5">
          {videoUrl ? (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-cover"
                poster="/placeholder.svg"
                onPlay={() => { setIsPlaying(true); setVideoEnded(false); }}
                onPause={() => setIsPlaying(false)}
                onEnded={() => { setIsPlaying(false); setVideoEnded(true); updateLevel(3); }}
                playsInline
              />
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
              {videoEnded && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-500">
                  <p className="text-white text-base font-medium mb-4">
                    Un retour ou une question ?
                  </p>
                  {!commentSent ? (
                    <div className="w-full max-w-sm flex gap-2">
                      <Input
                        placeholder="Laisser un petit mot..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit()}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                      />
                      <Button size="icon" onClick={handleCommentSubmit}
                        disabled={!comment.trim()}
                        style={{ backgroundColor: config.brandColor }}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-white/60 text-sm">Commentaire envoyé</p>
                  )}
                  <div className="flex gap-3 mt-4">
                    <Button variant="outline"
                      className="text-white border-white/30 hover:bg-white/10 gap-2"
                      onClick={() => {
                        const video = videoRef.current;
                        if (video) { video.currentTime = 0; video.play(); setVideoEnded(false); }
                      }}>
                      <Play className="h-4 w-4" />Revoir
                    </Button>
                    <Button variant="outline"
                      className="text-white border-white/30 hover:bg-white/10 gap-2"
                      onClick={() => setShowInviteDialog(true)}>
                      <Share2 className="h-4 w-4" />Partager à un collègue
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : assetType === null ? (
            <div className="flex items-center justify-center h-full">
              <EkkoLoader mode="loop" size={24} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 p-8">
              <p className="text-sm text-muted-foreground text-center">
                Ce contenu est en cours de préparation.
              </p>
              <p className="text-xs text-muted-foreground/60 text-center">
                Vous serez contacté dès qu'il est disponible.
              </p>
            </div>
          )}
        </div>
      );
    }
    if (assetType === "document" && fileUrl) {
      return (
        <div className="rounded-xl overflow-hidden border border-border shadow-md mb-5">
          <iframe src={fileUrl} className="w-full" style={{ height: "clamp(320px, 70vh, 800px)" }} title="Document" />
          <div className="py-2 text-center border-t border-border/50">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors">
              Ouvrir dans un nouvel onglet
            </a>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderFooter = () => (
    <footer className="py-6 px-6 text-center space-y-1 mt-4">
      <p className="text-[11px] text-muted-foreground/50 leading-relaxed max-w-sm mx-auto">
        Votre interaction avec ce contenu peut être mesurée dans le cadre de cette proposition commerciale.
      </p>
      <p className="text-[10px] text-muted-foreground/30">
        Propulsé par{" "}
        <a href="/" className="hover:underline">Ekko</a>
      </p>
    </footer>
  );

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <EkkoLoader mode="loop" size={32} />
      </div>
    );
  }

  // ─── Replaced version ───
  if (isReplacedByNewerVersion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm space-y-3">
          <p className="text-base font-medium text-foreground">Une version mise à jour est disponible.</p>
          <p className="text-sm text-muted-foreground">Demandez le nouveau lien à votre interlocuteur.</p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm space-y-3">
          <p className="text-base font-medium text-foreground">Ce lien n'est plus disponible.</p>
          <p className="text-sm text-muted-foreground">Contactez votre interlocuteur pour recevoir un nouveau lien.</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════
  return (
    <div className={`min-h-screen flex flex-col bg-background ${isPreviewMode ? "pt-8" : ""}`}>

      {/* Barre preview AE */}
      {isPreviewMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#0D1B2A] text-white text-xs py-2 text-center">
          Mode prévisualisation · Vos modifications s'affichent ici
        </div>
      )}

      {/* HEADER HUMAIN */}
      <header className="py-8 px-6 text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-3"
          style={{ backgroundColor: config.brandColor }}>
          {aeInitials || "?"}
        </div>
        <p className="text-sm font-semibold text-foreground">{aeName}</p>
        {prospectMessage && (
          <p className="text-xs text-muted-foreground italic mt-1 max-w-xs mx-auto leading-relaxed">
            {prospectMessage}
          </p>
        )}
        {hasBeenSeen && !isPreviewMode && (
          <p className="text-[10px] text-muted-foreground/40 mt-2 animate-in fade-in duration-500">
            Content de vous revoir.
          </p>
        )}
        {campaignName && (
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            Préparé pour {campaignName}
          </p>
        )}
      </header>

      {/* NOUVEAU DEPUIS VOTRE DERNIÈRE VISITE */}
      {hasBeenSeen && newAssets.length > 0 && !isPreviewMode && (
        <div className="mx-4 mb-4 px-4 py-3 bg-accent/8 border border-accent/20 rounded-xl animate-in fade-in duration-500">
          <p className="text-xs font-medium text-accent mb-2">
            Nouveau depuis votre dernière visite
          </p>
          <div className="space-y-1.5">
            {newAssets.map((asset: any) => (
              <button key={asset.id}
                onClick={() => handleSecondaryAssetClick(asset)}
                className="w-full flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
                <span className="text-sm shrink-0">
                  {asset.asset_type === "video" ? "🎥" : "📄"}
                </span>
                <span className="text-xs text-foreground underline">{asset.label_fr}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Pages d'identification ─── */}
      {identificationStep !== "done" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">

          {/* PAGE "QUI EST IMPLIQUÉ" */}
          {identificationStep === "who" && (
            <div className="w-full max-w-md">
              <p className="text-base font-semibold text-foreground text-center mb-1">
                Qui est impliqué dans ce sujet ?
              </p>
              <p className="text-xs text-muted-foreground text-center mb-3">
                Identifiez-vous pour accéder à l'espace
              </p>
              {knownContacts.length > 1 && (
                <p className="text-[11px] text-muted-foreground/70 text-center mb-5 italic">
                  Sont aussi impliqués dans cette décision
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 mb-5">
                {knownContacts.map(contact => (
                  <button key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className="flex flex-col items-center gap-1.5 p-4 rounded-xl
                               border border-border hover:border-accent/40
                               hover:bg-accent/5 transition-all text-center group">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center
                                    justify-center text-sm font-semibold text-foreground">
                      {contact.name.split(" ").map((w: string) => w[0] || "")
                        .join("").toUpperCase().slice(0, 2)}
                    </div>
                    <span className="text-sm font-medium text-foreground
                                     group-hover:text-accent transition-colors
                                     leading-tight">
                      {contact.name}
                    </span>
                    {contact.title && (
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {contact.title}
                      </span>
                    )}
                    {contact.layer && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border
                                       border-border text-muted-foreground/60 capitalize">
                        {LAYER_LABELS[contact.layer] || contact.layer}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {!showSelfRegister ? (
                <button
                  onClick={() => {
                    handleSignal("engagement_signal", "declared", {
                      signal: "not_in_list_clicked",
                    });
                    setShowSelfRegister(true);
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground
                             underline transition-colors text-center py-2">
                  Je ne suis pas dans cette liste
                </button>
              ) : (
                <div className="space-y-2 mt-2">
                  <Input placeholder="Votre prénom"
                    value={selfRegisterName}
                    onChange={(e) => setSelfRegisterName(e.target.value)} />
                  <Input type="email" placeholder="Votre email professionnel"
                    value={selfRegisterEmail}
                    onChange={(e) => setSelfRegisterEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSelfRegister()} />
                  <Button size="sm" className="w-full" onClick={handleSelfRegister}
                    disabled={!selfRegisterName.trim() || !selfRegisterEmail.trim()}>
                    Confirmer
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* PAGE TOPICS */}
          {identificationStep === "topics" && (
            <div className="w-full max-w-sm">
              {identifiedViewer && (
                <p className="text-sm font-medium text-foreground text-center mb-1">
                  Bonjour {identifiedViewer.name.split(" ")[0] || identifiedViewer.name},
                </p>
              )}
              <p className="text-base font-semibold text-foreground text-center mb-1">
                {knownContacts.length === 0
                  ? "Identifiez ce qui compte pour vous"
                  : "Qu'est-ce qui compte le plus pour vous ?"}
              </p>
              <p className="text-xs text-muted-foreground text-center mb-4">
                Sélectionnez un ou plusieurs sujets
              </p>
              {suggestedTopic && (
                <p className="text-[10px] text-accent/80 text-center mb-3">
                  Souvent pertinent pour votre rôle
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 mb-6">
                {topicsEnabled.map(topic => (
                  <button key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium
                      transition-all text-left ${
                        selectedTopics.includes(topic)
                          ? "border-accent bg-accent/10 text-accent"
                          : suggestedTopic === topic
                            ? "border-accent/40 bg-accent/5 text-foreground"
                            : "border-border text-muted-foreground hover:border-accent/30 hover:bg-muted/30"
                      }`}>
                    {TOPIC_LABELS[topic] || topic}
                  </button>
                ))}
              </div>

              <Button className="w-full" onClick={handleTopicsSubmit}
                disabled={selectedTopics.length === 0}
                style={{ backgroundColor: config.brandColor, color: "white" }}>
                Continuer
              </Button>

              <button
                onClick={() => {
                  handleSignal("prospect_feedback", "declared", { response: "skip_topics" });
                  setIdentificationStep("done");
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground
                           underline transition-colors text-center py-3 mt-1">
                Passer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contenu principal — visible uniquement si identification terminée */}
      {identificationStep === "done" && (
        <>
          {/* ─── MODE SIMPLE ─── */}
          {experienceMode === "simple" && (
            <>
              {renderAssetZone()}
              <div className="pb-5 text-center">
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-2"
                  onClick={() => setShowInviteDialog(true)}>
                  <Share2 className="h-4 w-4" />
                  Partager à un collègue
                </Button>
              </div>
              {renderFooter()}
            </>
          )}

          {/* ─── MODE DEAL ROOM ─── */}
          {experienceMode === "deal_room" && (
            <>
              {/* Toggle scan */}
              {summaryBullets.length > 0 && (
                <div className="flex justify-end px-6 mb-2">
                  <div className="flex rounded-full border border-border overflow-hidden text-xs">
                    {[
                      { label: "Résumé", value: true },
                      { label: "Contenu complet", value: false },
                    ].map(({ label, value }) => (
                      <button key={label}
                        onClick={() => setScanMode(value)}
                        className={`px-3 py-1 transition-colors ${
                          scanMode === value
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-muted/50"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Résumé 3 points */}
              {summaryBullets.length > 0 && (
                <section className="px-6 pb-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    En 3 points
                  </p>
                  <div className="space-y-2">
                    {summaryBullets.map((bullet, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-accent mt-0.5 shrink-0 text-sm">✓</span>
                        <span className="text-sm text-foreground">{bullet}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Cadre de décision */}
              {contextBullets.length > 0 && !scanMode && (
                <section className="px-6 pb-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Pour avancer sur ce sujet
                  </p>
                  <div className="space-y-2">
                    {contextBullets.map((bullet, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-accent mt-0.5 shrink-0 text-sm">✓</span>
                        <span className="text-sm text-foreground">{bullet}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Asset principal */}
              {!scanMode && (
                <main className="px-4 pb-4">
                  {versionNumber !== null && versionNumber > 1 && (
                    <div className="text-center mb-3">
                      <span className="text-[10px] text-muted-foreground/50 px-2 py-0.5 rounded border border-border/50">
                        Version {versionNumber}
                      </span>
                    </div>
                  )}
                  {renderAssetZone()}
                </main>
              )}

              {/* NIVEAU 1 */}
              {level1Visible && !level1Answer && (
                <div className="px-4 pb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="border border-border rounded-xl p-4 bg-card">
                    <p className="text-sm font-medium text-foreground mb-3">
                      C'est assez clair jusqu'ici ?
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1"
                        onClick={() => handleLevel1("yes")}>
                        Oui
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1"
                        onClick={() => handleLevel1("no")}>
                        Non, j'ai une question
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA DISCRET niveau 2 */}
              {engagementLevel >= 2 && config.ctaUrl && (
                <div className="px-6 pb-2 text-center">
                  <button
                    onClick={() => {
                      trackEvent({ ...baseTrackParams(), event_type: "cta_clicked",
                        event_data: { cta_type: "early_exit", position: "level_2" } });
                      window.open(config.ctaUrl, "_blank");
                    }}
                    className="text-xs text-muted-foreground underline hover:text-foreground transition-colors">
                    Planifier un échange →
                  </button>
                </div>
              )}

              {/* NIVEAU 2 — Assets secondaires */}
              {engagementLevel >= 2 && secondaryAssets.length > 0 && (
                <section className="px-6 pb-5 animate-in fade-in duration-500">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Pour approfondir
                  </p>
                  <div className="space-y-2">
                    {secondaryAssets.map((asset: any) => (
                      <button key={asset.id}
                        onClick={() => handleSecondaryAssetClick(asset)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-accent/30 hover:bg-accent/5 transition-all text-left group">
                        <span className="text-base shrink-0">
                          {asset.asset_type === "video" ? "🎥" : "📄"}
                        </span>
                        <span className="text-sm text-foreground group-hover:text-accent transition-colors flex-1">
                          {asset.label_fr}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Réduction du risque */}
              {engagementLevel >= 1 && (
                <section className="mx-4 mb-5 px-5 py-4 bg-muted/30 rounded-xl animate-in fade-in duration-500">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    À savoir
                  </p>
                  {[
                    "Déjà déployé dans des environnements similaires",
                    "Sans impact sur vos systèmes existants",
                    "Approche progressive possible",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 mb-1.5 last:mb-0">
                      <span className="text-muted-foreground/50 shrink-0 mt-0.5 text-xs">•</span>
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </section>
              )}

              {/* NIVEAU 3 — Moment de bascule */}
              {engagementLevel >= 3 && (
                <section className="px-6 py-6 text-center animate-in fade-in duration-500">
                  <p className="text-sm font-medium text-foreground mb-5">
                    Ces éléments répondent-ils à votre besoin ?
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      onClick={() => {
                        handleSignal("prospect_feedback", "declared", { response: "yes" });
                        trackEvent({ ...baseTrackParams(), event_type: "cta_clicked",
                          event_data: { cta_type: "oui_avançons" } });
                        if (config.ctaUrl) window.open(config.ctaUrl, "_blank");
                      }}
                      className="px-6 font-medium"
                      style={{ backgroundColor: config.brandColor, color: "white" }}>
                      Oui, avançons
                    </Button>
                    <Button variant="outline" className="px-6"
                      onClick={() => setShowFeedbackInput(true)}>
                      Un point me semble flou
                    </Button>
                    <Button variant="ghost" className="px-6 text-muted-foreground"
                      onClick={() => {
                        handleSignal("prospect_feedback", "declared", { response: "not_now" });
                        setFeedbackSent(true);
                      }}>
                      Intéressé, pas maintenant
                    </Button>
                  </div>

                  {showFeedbackInput && !feedbackSent && (
                    <div className="mt-5 max-w-sm mx-auto space-y-2">
                      <Textarea
                        placeholder="Votre question ou point de blocage..."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value.slice(0, 300))}
                        rows={3}
                        className="resize-none"
                      />
                      <Button size="sm" className="w-full"
                        onClick={handleFeedbackSubmit}
                        disabled={!feedbackText.trim()}>
                        Envoyer
                      </Button>
                    </div>
                  )}

                  {feedbackSent && (
                    <p className="text-xs text-muted-foreground mt-4">
                      Reçu.{" "}
                      {aeName.split(" ")[0] || "Votre interlocuteur"}{" "}
                      vous répondra rapidement.
                    </p>
                  )}
                </section>
              )}

              {/* CTA final */}
              {engagementLevel >= 3 && config.ctaUrl && (
                <section className="px-6 pb-4 text-center">
                  <Button size="lg"
                    className="px-8 py-6 text-base font-semibold rounded-xl transition-transform hover:scale-105 gap-2"
                    style={{ backgroundColor: config.brandColor, color: "white" }}
                    onClick={() => {
                      trackEvent({ ...baseTrackParams(), event_type: "cta_clicked",
                        event_data: { cta_type: config.ctaText } });
                      window.open(config.ctaUrl, "_blank");
                    }}>
                    {config.ctaText}
                    <ExternalLink className="h-5 w-5" />
                  </Button>
                </section>
              )}

              {/* Partage */}
              <div className="pb-5 text-center">
                <Button variant="ghost" size="sm"
                  className="text-muted-foreground gap-2 hover:text-foreground"
                  onClick={() => setShowInviteDialog(true)}>
                  <Share2 className="h-4 w-4" />
                  Partager à un collègue
                </Button>
              </div>

              {renderFooter()}
            </>
          )}
        </>
      )}

      {/* Sheet asset secondaire */}
      <Sheet open={!!activeSecondaryAsset} onOpenChange={(o) => !o && setActiveSecondaryAsset(null)}>
        <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col rounded-t-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <p className="text-sm font-medium text-foreground">
              {activeSecondaryAsset?.label_fr}
            </p>
            <a href={activeSecondaryAsset?.file_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline hover:text-foreground">
              Ouvrir dans un nouvel onglet
            </a>
          </div>
          <div className="flex-1 overflow-hidden">
            {activeSecondaryAsset?.asset_type === "document" && (
              <iframe src={activeSecondaryAsset.file_url} className="w-full h-full border-0"
                title={activeSecondaryAsset.label_fr} />
            )}
            {activeSecondaryAsset?.asset_type === "video" && (
              <video src={activeSecondaryAsset.file_url} controls
                className="w-full h-full object-contain bg-black" />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog partage collègue */}
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
              Partagez ce contenu avec un collègue.
            </p>
            <Input placeholder="Nom du collègue" value={inviteName}
              onChange={(e) => setInviteName(e.target.value)} />
            <Input placeholder="Email professionnel" type="email" value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInviteSend()} />
            <Button className="w-full gap-2"
              style={{ backgroundColor: config.brandColor, color: "white" }}
              onClick={handleInviteSend} disabled={inviteSending}>
              <Send className="h-4 w-4" />
              {inviteSending ? "Envoi..." : "Envoyer l'invitation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
