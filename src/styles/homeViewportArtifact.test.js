import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function readCss(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("homepage viewport artifact guards", () => {
  test("sea flow layers are fully removed from homepage CSS", () => {
    const css = readCss("src/styles/HomeMapFirst.module.css");
    expect(css).not.toMatch(/\.pageSeaFlowLayers\b/);
    expect(css).not.toMatch(/\.heroCanvasSeaFlowLayers\b/);
    expect(css).not.toMatch(/--sea-flow-/);
    expect(css).not.toMatch(/@keyframes seaFlow/);
  });

  test("document shell avoids 100vw gutter and forces light canvas color", () => {
    const css = readCss("src/styles/globals.css");
    expect(css).not.toMatch(/max-width:\s*100vw/);
    expect(css).toMatch(/html\s*\{[^}]*background-color:/s);
    expect(css).toMatch(/color-scheme:\s*light/);
    expect(css).not.toMatch(/color-scheme:\s*dark/);
  });

  test("homepage disables the global fixed blur wash entirely", () => {
    const css = readCss("src/styles/globals.css");
    expect(css).toMatch(/body:has\(\.home-map-page-root\)::before[\s\S]*content:\s*none/);
  });
});
