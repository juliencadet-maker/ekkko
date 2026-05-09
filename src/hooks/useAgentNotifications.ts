// Phase 4 — Realtime feed of agent notifications + pending actions for the AE.
// Subscribes via postgres_changes filtered by user_id (RLS enforces isolation
// server-side; this filter just reduces client-side noise).
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AgentNotification = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  kind: "agent_recommendation" | "coaching_nudge" | "external_action_pending" | "system_failure";
  title: string;
  body: string | null;
  payload: any;
  status: "pending" | "delivered" | "dismissed" | "expired";
  created_at: string;
};

export type PendingAction = {
  id: string;
  user_id: string;
  org_id: string;
  campaign_id: string;
  deal_room_id: string | null;
  action_type:
    | "change_voice_source" | "publish_deal_room" | "send_external_message"
    | "send_exec_email" | "change_gate_mode" | "clone_deal_room" | "archive_deal_room";
  payload: any;
  status: "pending" | "approved" | "rejected" | "executed" | "expired";
  created_at: string;
  decided_at: string | null;
  expires_at: string;
};

export function useAgentNotifications(userId: string | null | undefined) {
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [recentDecided, setRecentDecided] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [nq, pa, decided] = await Promise.all([
      supabase.from("agent_notification_queue")
        .select("*").eq("user_id", userId).neq("status", "dismissed")
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("pending_external_actions")
        .select("*").eq("user_id", userId).eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase.from("pending_external_actions")
        .select("*").eq("user_id", userId).in("status", ["executed", "rejected", "expired"])
        .gte("decided_at", since).order("decided_at", { ascending: false }).limit(20),
    ]);
    setNotifications((nq.data ?? []) as AgentNotification[]);
    setPendingActions((pa.data ?? []) as PendingAction[]);
    setRecentDecided((decided.data ?? []) as PendingAction[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`agent-notifs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_notification_queue", filter: `user_id=eq.${userId}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_external_actions", filter: `user_id=eq.${userId}` },
        () => refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, refresh]);

  const dismissNotification = useCallback(async (id: string) => {
    await supabase.from("agent_notification_queue")
      .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
      .eq("id", id);
    refresh();
  }, [refresh]);

  const decideAction = useCallback(async (id: string, decision: "approve" | "reject") => {
    const { data, error } = await supabase.functions.invoke("pending-action-decide", {
      body: { pending_action_id: id, decision },
    });
    if (!error) refresh();
    return { data, error };
  }, [refresh]);

  return {
    notifications,
    pendingActions,
    recentDecided,
    loading,
    pendingCount: pendingActions.length,
    refresh,
    dismissNotification,
    decideAction,
  };
}
