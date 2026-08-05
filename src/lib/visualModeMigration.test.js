/** @jest-environment node */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const FIX_MIGRATION = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260805130000_fix_visual_mode_intensity_format.sql"
);

describe("visual mode migration regression", () => {
  test("fix migration stores sea flow intensity without literal hash suffix", () => {
    const sql = fs.readFileSync(FIX_MIGRATION, "utf8");
    expect(sql).toContain("update_visual_mode_platform_config");
    expect(sql).not.toMatch(/to_char\(p_sea_flow_intensity,\s*'FM9999990\.0#'\)/);
    expect(sql).toMatch(/to_char\(p_sea_flow_intensity,\s*'FM999999990\.0999999'\)/);
  });
});
