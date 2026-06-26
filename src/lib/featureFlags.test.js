import { readFileSync } from "fs";
import { join } from "path";
import { readTruthyEnvValue } from "./featureFlags";

describe("readTruthyEnvValue", () => {
  test("returns false for empty or unset values", () => {
    expect(readTruthyEnvValue(undefined)).toBe(false);
    expect(readTruthyEnvValue(null)).toBe(false);
    expect(readTruthyEnvValue("")).toBe(false);
    expect(readTruthyEnvValue("   ")).toBe(false);
  });

  test("returns true for 1 or true (case-insensitive)", () => {
    expect(readTruthyEnvValue("1")).toBe(true);
    expect(readTruthyEnvValue("true")).toBe(true);
    expect(readTruthyEnvValue("TRUE")).toBe(true);
  });

  test("returns false for other strings", () => {
    expect(readTruthyEnvValue("false")).toBe(false);
    expect(readTruthyEnvValue("0")).toBe(false);
    expect(readTruthyEnvValue("yes")).toBe(false);
  });
});

describe("featureFlags build-time inlining", () => {
  test("uses static NEXT_PUBLIC_* references (no dynamic process.env[key])", () => {
    const src = readFileSync(join(__dirname, "featureFlags.js"), "utf8");
    expect(src).not.toMatch(/process\.env\[["']NEXT_PUBLIC_/);
    expect(src).toMatch(/process\.env\.NEXT_PUBLIC_BL_ENABLE_INQUIRIES/);
    expect(src).toMatch(/process\.env\.NEXT_PUBLIC_BL_ENABLE_TURNSTILE/);
  });
});
