import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuditEventType } from "@/types/database";
import type { Json } from "@/integrations/supabase/types";

interface LogEventParams {
  eventType: AuditEventType;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function useAuditLog() {
  const logEvent = useCallback(async ({
    eventType,
    entityType,
    entityId,
    oldValues,
    newValues,
    metadata = {},
  }: LogEventParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's org_id
      const { data: membership } = await supabase
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      await supabase.from("audit_logs").insert({
        org_id: membership?.org_id || null,
        user_id: user.id,
        event_type: eventType,
        entity_type: entityType || null,
        entity_id: entityId || null,
        old_values: (oldValues as Json) || null,
        new_values: (newValues as Json) || null,
        metadata: (metadata as Json) || null,
      });
    } catch {
      console.error("Failed to log audit event");
    }
  }, []);

  return { logEvent };
}
