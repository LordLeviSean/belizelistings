/** @jest-environment node */

import fs from "fs";
import path from "path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260731130000_agent_upgrade_submission_notifications.sql"
);

describe("20260731130000_agent_upgrade_submission_notifications migration", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

  test("defines cycle-scoped submission event presentation", () => {
    expect(sql).toMatch(/WHEN 'agent_upgrade_submitted'/);
    expect(sql).toMatch(/agent_upgrade_submitted:/);
    expect(sql).toMatch(/WHEN 'agent_upgrade_requested'/);
    expect(sql).toMatch(/agent_upgrade_requested:/);
  });

  test("submit RPC creates request and delivers notifications in one transaction", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.submit_agent_upgrade_request/);
    expect(sql).toMatch(/bl\.upgrade_notification_internal/);
    expect(sql).toMatch(/deliver_notification/);
    expect(sql).toMatch(/lower\(COALESCE\(p\.role, ''\)\) = 'admin'/);
  });

  test("enqueue auth allows requester submitted event for own pending cycle", () => {
    expect(sql).toMatch(/WHEN 'agent_upgrade_submitted'/);
    expect(sql).toMatch(/aur\.status = 'pending'/);
  });
});
