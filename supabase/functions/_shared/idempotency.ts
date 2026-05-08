// Phase 1c-2 — Helper idempotency (Q5/Q6).
// TTL default 7 jours (DB default). Conflict body diff → 409 + hashes.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface IdempotencyCheckInput {
  supabase: SupabaseClient;
  key: string;
  scope: string;
  bodyHash: string;
  org_id?: string | null;
  campaign_id?: string | null;
}

export interface IdempotencyHit {
  hit: true;
  cached_response: unknown;
}
export interface IdempotencyConflict {
  conflict: true;
  cached_body_hash: string;
  current_body_hash: string;
}
export interface IdempotencyMiss {
  hit: false;
  conflict: false;
}

export type IdempotencyResult = IdempotencyHit | IdempotencyConflict | IdempotencyMiss;

export async function checkIdempotency(
  input: IdempotencyCheckInput,
): Promise<IdempotencyResult> {
  const { data } = await input.supabase
    .from("idempotency_keys")
    .select("request_hash, response, expires_at")
    .eq("key", input.key)
    .maybeSingle();

  if (!data) return { hit: false, conflict: false };

  // Expired? treat as miss (cron will purge).
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { hit: false, conflict: false };
  }

  if (data.request_hash && data.request_hash !== input.bodyHash) {
    return {
      conflict: true,
      cached_body_hash: data.request_hash,
      current_body_hash: input.bodyHash,
    } as IdempotencyConflict;
  }

  return { hit: true, cached_response: data.response };
}

export async function storeIdempotency(input: {
  supabase: SupabaseClient;
  key: string;
  scope: string;
  bodyHash: string;
  response: unknown;
  org_id?: string | null;
  campaign_id?: string | null;
}): Promise<void> {
  const row: Record<string, unknown> = {
    key: input.key,
    scope: input.scope,
    request_hash: input.bodyHash,
    response: input.response,
  };
  if (input.org_id) row.org_id = input.org_id;
  if (input.campaign_id) row.campaign_id = input.campaign_id;
  await input.supabase.from("idempotency_keys").upsert(row, { onConflict: "key" });
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
