// Phase 1c-2 — Helper standardisé pour log system_failures (Q4).
// Schema reason : JSON stringifié avec champs obligatoires.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type FailureSeverity = "low" | "medium" | "high" | "critical";
export type FailureProvider = "voxtral" | "tavus" | "heygen" | "mistral" | "internal";

export interface FailureReason {
  error_code: string;
  provider: FailureProvider;
  attempt_n: number;
  request_id: string | null;
  deal_room_version_id: string | null;
  timestamp_iso: string;
  // Optional extras
  payload_hash?: string;
  external_ref?: string;
  [k: string]: unknown;
}

export interface LogFailureInput {
  supabase: SupabaseClient;
  failure_type: string;
  severity: FailureSeverity;
  reason: Omit<FailureReason, "timestamp_iso"> & { timestamp_iso?: string };
  org_id?: string | null;
  campaign_id?: string | null;
}

export async function logSystemFailure(input: LogFailureInput): Promise<void> {
  const reason: FailureReason = {
    timestamp_iso: new Date().toISOString(),
    ...input.reason,
  } as FailureReason;

  const row: Record<string, unknown> = {
    failure_type: input.failure_type,
    severity: input.severity,
    reason: JSON.stringify(reason),
  };
  if (input.org_id) row.org_id = input.org_id;
  if (input.campaign_id) row.campaign_id = input.campaign_id;

  const { error } = await input.supabase.from("system_failures").insert(row);
  if (error) console.error("[system_failures] insert failed:", error.message, "row:", row);
}
