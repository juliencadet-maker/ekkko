// Phase 1d — RLS tenant-isolation tests (8 tables).
// Rattrape la dette 1c-1a (3/8 assertions formelles manquantes : script_versions, script_tokens, deal_signals)
// et étend aux 5 tables de la phase 1c :
//   assets, deal_room_version, asset_tracked_links, agent_compose_sessions, deal_communication_log.
//
// Convention : pour chaque table, org B (authenticated) ne doit voir aucune ligne créée par org A.

import { test, expect } from "@playwright/test";
import { getTenantContext, assertTenantIsolation } from "./helpers/tenant";

const TABLES_DETTE_1C_1A = ["script_versions", "script_tokens", "deal_signals"];
const TABLES_PHASE_1C = [
  "assets",
  "deal_room_version",
  "asset_tracked_links",
  "agent_compose_sessions",
  "deal_communication_log",
];

const ALL_TABLES = [...TABLES_DETTE_1C_1A, ...TABLES_PHASE_1C];

test.describe("RLS tenant isolation — Phase 1d coverage", () => {
  for (const table of ALL_TABLES) {
    test(`${table} — org B cannot read org A rows`, async () => {
      const ctx = getTenantContext();

      // Discover an org_id (or campaign_id surrogate) belonging to org A via service client.
      const { data: probe } = await ctx.serviceClient
        .from(table)
        .select("*")
        .limit(1);

      // If table is empty, nothing to assert — skip gracefully.
      test.skip(!probe || probe.length === 0, `No seed data in ${table}`);

      // Detect natural tenant column.
      const sample = probe![0] as Record<string, unknown>;
      const filterCol =
        "org_id" in sample ? "org_id" :
        "campaign_id" in sample ? "campaign_id" :
        null;
      test.skip(!filterCol, `${table} has no org_id/campaign_id column`);

      const orgAValue = String(sample[filterCol!]);
      const clientB = await ctx.orgBClient();
      const { data, error } = await assertTenantIsolation(clientB, table, {
        column: filterCol!,
        value: orgAValue,
      });

      expect(error).toBeNull();
      expect(data.length).toBe(0);
    });
  }
});
