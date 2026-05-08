import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CockpitDeal {
  id: string;
  company: string;
  deal_status: string;
  risk_level: string;
  des: number | null;
  priority_score: number;
  trajectory: string;
  momentum: number | null;
  days_since_last_signal: number | null;
  recommended_action: string | null;
  crm_stage: string | null;
  deal_value: number | null;
  updated_at: string;
}

export interface CockpitFeed {
  meta: { generated_at: string; scope: string; deal_count: number };
  cockpit: {
    top_priority: CockpitDeal[];
    moving: CockpitDeal[];
    at_risk: CockpitDeal[];
    observing: CockpitDeal[];
    silent: CockpitDeal[];
  };
  inbox: {
    events: any[];
    pending_questions: number;
    active_triggers: any[];
    new_signals_count: number;
  };
  momentum: { accelerating: number; stable: number; slipping: number };
  badges: {
    new_signals: number;
    pending_questions: number;
    active_triggers: number;
    global_attention: number;
  };
}

export function useAECockpitFeed(pollMs = 60_000) {
  const [data, setData] = useState<CockpitFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    try {
      const { data: res, error: err } = await supabase.functions.invoke(
        "get-ae-cockpit-feed",
        { body: {} },
      );
      if (err) throw err;
      setData(res as CockpitFeed);
      setError(null);
    } catch (e: any) {
      setError(e.message || "fetch_error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    if (!pollMs) return;
    const t = setInterval(fetchFeed, pollMs);
    return () => clearInterval(t);
  }, [fetchFeed, pollMs]);

  return { data, loading, error, refetch: fetchFeed };
}
