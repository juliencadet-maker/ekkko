// Phase 1d — V1.5 isolation static check.
// Goal : ensure the V1.5 prospect surface (V15Room + children) does NOT leak any reference
// to legacy V0 tables (`script_versions`, `script_oral`) — they are V0-only by spec
// (mem://constraints — V0 et V1.5 coexist, jamais merge).

import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const V15_ROOT = "src/components/prospect/v15";
const V15_PAGE = "src/pages/prospect/V15Room.tsx";
const FORBIDDEN_TOKENS = ["script_versions", "script_oral"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

test("V1.5 surface contains no V0 table references", () => {
  const files = [...walk(V15_ROOT), V15_PAGE];
  const offenders: Array<{ file: string; token: string }> = [];

  for (const file of files) {
    const src = readFileSync(file, "utf-8");
    for (const token of FORBIDDEN_TOKENS) {
      if (src.includes(token)) offenders.push({ file, token });
    }
  }

  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
});
