/** @jest-environment node */

import fs from "fs";
import path from "path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260731120000_agent_upgrade_request_cycles.sql"
);

describe("20260731120000_agent_upgrade_request_cycles migration", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

  test("documents row id as canonical upgrade_request_id / cycle identifier", () => {
    expect(sql).toMatch(/Canonical upgrade_request_id \/ request cycle identifier/);
  });

  test("adds user history index for cycle queries", () => {
    expect(sql).toMatch(/agent_upgrade_requests_user_requested_at_idx/);
    expect(sql).toMatch(/user_id, requested_at DESC/);
  });

  test("idempotent duplicate pending cleanup keeps newest pending row", () => {
    expect(sql).toMatch(/HAVING count\(\*\) > 1/);
    expect(sql).toMatch(/ORDER BY requested_at DESC NULLS LAST/);
    expect(sql).toMatch(/LIMIT 1/);
    expect(sql).toMatch(/status = 'rejected'/);
  });
});
