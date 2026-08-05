import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function readCss(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function ruleBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`, "s"));
  return match?.[0] ?? "";
}

describe("homepage viewport artifact guards", () => {
  test("page sea-flow layers do not clip blurred gradients to black edges", () => {
    const css = readCss("src/styles/HomeMapFirst.module.css");
    const block = ruleBlock(css, ".pageSeaFlowLayers");
    expect(block).toContain("overflow: visible");
    expect(block).not.toMatch(/overflow:\s*hidden/);
    expect(block).not.toMatch(/contain:\s*strict/);
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
