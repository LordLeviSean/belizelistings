import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function readCss(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function readSource(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("homepage static background guards", () => {
  test("homepage root uses the unified static whitish gradient", () => {
    const css = readCss("src/styles/HomeMapFirst.module.css");
    const pageBlock = css.match(/\.page\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(pageBlock).toMatch(/linear-gradient\(\s*165deg,\s*#f2faf8 0%/);
    expect(pageBlock).toMatch(/#fdfcfb 100%/);
    expect(pageBlock).toMatch(/radial-gradient\(ellipse 56% 44% at 4% 8%/);
    expect(pageBlock).not.toMatch(/--home-base-color/);
  });

  test("structural homepage sections have no decorative backgrounds or masks", () => {
    const css = readCss("src/styles/HomeMapFirst.module.css");
    expect(css).toMatch(/\.featuredSection[\s\S]*background:\s*transparent/);
    expect(css).toMatch(/\.featuredCarouselViewport[\s\S]*background:\s*transparent/);
    expect(css).not.toMatch(/\.featuredCarouselViewport[\s\S]*mask-image:/);
    expect(css).toMatch(/\.communitySection[\s\S]*background:\s*transparent/);
    expect(css).toMatch(/\.communityCard[\s\S]*background:\s*transparent/);
    expect(css).toMatch(/\.communityCard::after[\s\S]*content:\s*none/);
  });

  test("listing card styles remain unchanged", () => {
    const css = readCss("src/styles/HomeMapFirst.module.css");
    const listingCard = readSource("src/components/ListingCard.jsx");
    expect(listingCard).toMatch(/homeStyles\.propertyCard/);
    expect(css).toMatch(/\.propertyCard\s*\{[\s\S]*radial-gradient\(circle at 18% -8%/);
    expect(css).toMatch(/\.propertyCardLand\s*\{[\s\S]*radial-gradient\(circle at 22% 0%/);
    expect(css).toMatch(/\.propertyMedia::after[\s\S]*linear-gradient\(/);
  });

  test("homepage does not mount first-load splash transition", () => {
    const page = readSource("src/pages/index.js");
    expect(page).not.toMatch(/HomeMapAwakensTransition/);
    expect(page).not.toMatch(/useHomeLoadingTransitionGate/);
    expect(page).not.toMatch(/bl_home_splash_seen_v1/);
  });

  test("homepage still renders map and functional hero content", () => {
    const page = readSource("src/pages/index.js");
    expect(page).toMatch(/BelizeMap/);
    expect(page).toMatch(/heroHeadline/);
    expect(page).toMatch(/featuredCarouselViewport/);
    expect(page).toMatch(/showAmbientVeil=\{false\}/);
  });
});

describe("homepage viewport artifact guards", () => {
  test("decorative hero canvas is retired in favor of static hero layout", () => {
    const css = readCss("src/styles/HomeMapFirst.module.css");
    const page = readSource("src/pages/index.js");
    expect(css).toMatch(/\.heroLayout\b/);
    expect(css).not.toMatch(/\.heroCanvas\b/);
    expect(css).not.toMatch(/\.heroCanvasAtmosphere\b/);
    expect(page).toMatch(/styles\.heroLayout/);
    expect(page).not.toMatch(/heroCanvas/);
  });

  test("sea flow and visual-mode layers are absent from homepage CSS", () => {
    const css = readCss("src/styles/HomeMapFirst.module.css");
    expect(css).not.toMatch(/\.pageSeaFlowLayers\b/);
    expect(css).not.toMatch(/\.heroCanvasSeaFlowLayers\b/);
    expect(css).not.toMatch(/--sea-flow-/);
    expect(css).not.toMatch(/@keyframes seaFlow/);
    expect(css).not.toMatch(/@keyframes heroAtmosphereGlow/);
    expect(css).not.toMatch(/@keyframes atmosphereDrift/);
    expect(css).not.toMatch(/@keyframes grainDrift/);
    expect(css).not.toMatch(/data-live-palette/);
    expect(css).not.toMatch(/data-pulse-mode/);
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

describe("visual mode retirement guards", () => {
  test("admin dashboard source has no visual-mode controls", () => {
    const admin = readSource("src/pages/admin/index.jsx");
    expect(admin).not.toMatch(/useVisualMode/);
    expect(admin).not.toMatch(/effectControls/);
    expect(admin).not.toMatch(/Live Palette/);
    expect(admin).not.toMatch(/Pulse Mode/);
    expect(admin).not.toMatch(/Sea Flow/);
  });

  test("nav wordmark CSS has no live palette or pulse selectors", () => {
    const css = readCss("src/components/SiteNavUnified.module.css");
    expect(css).not.toMatch(/\[data-live=/);
    expect(css).not.toMatch(/\[data-pulse=/);
    expect(css).not.toMatch(/@keyframes districtPalette/);
    expect(css).not.toMatch(/@keyframes brandPulseOnlyBreathe/);
  });

  test("bootstrap purges legacy visual-mode storage keys", () => {
    const doc = readSource("src/pages/_document.js");
    expect(doc).toMatch(/blz_live_palette_mode_v1/);
    expect(doc).toMatch(/blz_pulse_mode_v1/);
    expect(doc).toMatch(/removeAttribute\("data-live-palette"\)/);
    expect(doc).not.toMatch(/VisualModeProvider/);
  });
});
