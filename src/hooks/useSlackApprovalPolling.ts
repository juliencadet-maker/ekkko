import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that periodically polls the check-slack-replies edge function
 * to detect Slack-based approval decisions and sync them to the DB.
 * Runs every 30 seconds while the app is active.
 */
export function useSlackApprovalPolling(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const poll = async () => {
      try {
        await supabase.functions.invoke("check-slack-replies", {
          body: {},
        });
      } catch {
        // Silent fail — polling is best-effort
      }
    };

    // Initial check
    poll();

    // Poll every 30 seconds
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [enabled]);
}
