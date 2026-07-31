/** @jest-environment node */

import fs from "fs";
import path from "path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260731140000_agent_upgrade_resolution_notifications.sql"
);

describe("20260731140000_agent_upgrade_resolution_notifications migration", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

  test("defines cycle-scoped approve and decline presentation", () => {
    expect(sql).toMatch(/WHEN 'agent_upgrade_approved'/);
    expect(sql).toMatch(/agent_upgrade_approved:/);
    expect(sql).toMatch(/WHEN 'agent_upgrade_declined'/);
    expect(sql).toMatch(/agent_upgrade_declined:/);
  });

  test("resolve RPC is admin-only and idempotent for repeated status", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.resolve_agent_upgrade_request/);
    expect(sql).toMatch(/IF NOT public\.is_admin\(\)/);
    expect(sql).toMatch(/IF v_row\.status = p_next_status/);
    expect(sql).toMatch(/IF v_row\.status <> 'pending'/);
  });

  test("resolve RPC delivers one result notification per cycle", () => {
    expect(sql).toMatch(/deliver_notification/);
    expect(sql).toMatch(/v_event_type \|\| ':' \|\| v_row\.id::text/);
  });
});
