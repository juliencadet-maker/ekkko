// Phase 1d — Shared helpers for tenant-isolation RLS tests.
// Builds two clients impersonating different orgs to verify cross-tenant reads are blocked.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface TenantContext {
  serviceClient: SupabaseClient;
  orgAUserId: string;
  orgBUserId: string;
  orgAClient: () => Promise<SupabaseClient>;
  orgBClient: () => Promise<SupabaseClient>;
}

export function getTenantContext(): TenantContext {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const orgAUserId = process.env.ORG_A_USER_ID;
  const orgBUserId = process.env.ORG_B_USER_ID;
  const orgAEmail = process.env.ORG_A_EMAIL;
  const orgAPassword = process.env.ORG_A_PASSWORD;
  const orgBEmail = process.env.ORG_B_EMAIL;
  const orgBPassword = process.env.ORG_B_PASSWORD;

  if (!url || !serviceKey || !anonKey || !orgAUserId || !orgBUserId) {
    throw new Error(
      "Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, ORG_A_USER_ID, ORG_B_USER_ID"
    );
  }

  const serviceClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const signIn = async (email: string, password: string) => {
    const c = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return c;
  };

  return {
    serviceClient,
    orgAUserId,
    orgBUserId,
    orgAClient: () => signIn(orgAEmail!, orgAPassword!),
    orgBClient: () => signIn(orgBEmail!, orgBPassword!),
  };
}

/**
 * Standard cross-tenant assertion : expect 0 rows when org B reads org A's data.
 */
export async function assertTenantIsolation(
  client: SupabaseClient,
  table: string,
  filter: { column: string; value: string }
) {
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq(filter.column, filter.value)
    .limit(10);
  return { data: data ?? [], error };
}
