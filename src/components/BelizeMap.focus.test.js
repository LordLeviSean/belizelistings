import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function readCss(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function readSource(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("BelizeMap district focus styling", () => {
  test("suppresses bounding-box focus ring on pointer-activated district groups", () => {
    const css = readCss("src/components/BelizeMap.module.css");
    expect(css).toMatch(/\.mapDistrictGroup:focus\s*\{[\s\S]*outline:\s*none/);
    expect(css).toMatch(/\.mapDistrictGroup:focus:not\(:focus-visible\)/);
  });

  test("uses path-level focus-visible highlight for keyboard users", () => {
    const css = readCss("src/components/BelizeMap.module.css");
    expect(css).toMatch(/\.mapDistrictGroup:focus-visible[\s\S]*:global\(path\)/);
    expect(css).toMatch(/stroke-width:\s*2\.4/);
  });

  test("blurs district groups after pointer click but not keyboard activation", () => {
    const source = readSource("src/components/BelizeMap.jsx");
    expect(source).toMatch(/group\.blur\(\)/);
    expect(source).toMatch(/keyboardActivate/);
    expect(source).toMatch(/tabindex", "0"/);
  });
});
