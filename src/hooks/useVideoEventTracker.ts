import { useCallback, useRef } from "react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface TrackEventParams {
  video_id: string;
  campaign_id: string;
  viewer_hash: string;
  event_type: string;
  event_data?: Record<string, unknown>;
  viewer_email?: string;
  viewer_name?: string;
  device_type?: string;
  referrer?: string;
  referred_by_hash?: string;
  position_sec?: number;
  session_id?: string;
}

export function useVideoEventTracker() {
  const sessionIdRef = useRef<string>(
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  const trackEvent = useCallback(async (params: TrackEventParams) => {
    try {
      await fetch(`${supabaseUrl}/functions/v1/ingest-video-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          ...params,
          session_id: params.session_id || sessionIdRef.current,
          device_type: params.device_type || getDeviceType(),
        }),
      });
    } catch {
      // Silent — tracking should never break UX
    }
  }, []);

  return { trackEvent, sessionId: sessionIdRef.current };
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}
