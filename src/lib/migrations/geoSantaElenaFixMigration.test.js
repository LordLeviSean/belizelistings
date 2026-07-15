/** @jest-environment node */

import fs from "fs";
import path from "path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260715190000_fix_geo_backfill_santa_elena.sql"
);

describe("20260715190000_fix_geo_backfill_santa_elena migration", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

  test("backfill uses district-scoped Santa Elena branches", () => {
    expect(sql).toMatch(/v_sub = 'santa-elena' AND v_region = 'toledo'/);
    expect(sql).toMatch(/area-toledo-santa-elena/);
    expect(sql).toMatch(/v_sub = 'santa-elena' AND v_region = 'cayo'/);
    expect(sql).toMatch(/area-cayo-santa-elena/);
    expect(sql).not.toMatch(/WHEN 'santa-elena' THEN 'cayo'/);
  });

  test("notification_presentation_for_event restores viewing branches with entity_id", () => {
    expect(sql).toMatch(/WHEN 'viewing_requested'/);
    expect(sql).toMatch(/WHEN 'viewing_declined'/);
    expect(sql).toMatch(/WHEN 'viewing_rescheduled'/);
    expect(sql).toMatch(/entity_id := v_viewing_id/);
    expect(sql).toMatch(/geographic_update_v1/);
    expect(sql).toMatch(/entity_id := 'geographic-update-v1'/);
  });
});
