import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VideoJobProgress {
  id: string;
  campaign_id: string;
  recipient_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  provider_job_id: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  generationProgress?: number;
}

interface UseVideoJobPollingOptions {
  campaignId: string | undefined;
  orgId: string | undefined;
  enabled?: boolean;
  intervalMs?: number;
}

export function useVideoJobPolling({
  campaignId,
  orgId,
  enabled = true,
  intervalMs = 5000,
}: UseVideoJobPollingOptions) {
  const [jobs, setJobs] = useState<VideoJobProgress[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!campaignId || !orgId) return;

    const { data, error } = await supabase
      .from("video_jobs")
      .select("id, campaign_id, recipient_id, status, provider_job_id, error_message, started_at, completed_at")
      .eq("campaign_id", campaignId)
      .eq("org_id", orgId);

    if (error) {
      console.error("Failed to fetch video jobs:", error);
      return;
    }

    setJobs((data || []) as VideoJobProgress[]);
  }, [campaignId, orgId]);

  const hasActiveJobs = jobs.some(
    (j) => j.status === "queued" || j.status === "processing"
  );

  // Start/stop polling based on active jobs
  useEffect(() => {
    if (!enabled || !campaignId || !orgId) return;

    // Initial fetch
    fetchJobs();

    // Set up polling
    intervalRef.current = setInterval(fetchJobs, intervalMs);
    setIsPolling(true);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
    };
  }, [enabled, campaignId, orgId, intervalMs, fetchJobs]);

  // Stop polling once no active jobs remain
  useEffect(() => {
    if (jobs.length > 0 && !hasActiveJobs && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }
  }, [hasActiveJobs, jobs.length]);

  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const totalCount = jobs.length;
  const progressPercent =
    totalCount > 0 ? Math.round(((completedCount + failedCount) / totalCount) * 100) : 0;

  return {
    jobs,
    isPolling,
    hasActiveJobs,
    completedCount,
    failedCount,
    totalCount,
    progressPercent,
    refetch: fetchJobs,
  };
}
