import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");

function readCss(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function readSource(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("Learn More mobile presentation guards", () => {
  test("single-column layout constrains archive rail width on small screens", () => {
    const css = readCss("src/styles/LearnMore.module.css");
    const mobileLayout = css.match(/@media \(max-width: 860px\) \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(mobileLayout).toMatch(/\.archiveRail[\s\S]*min-width:\s*0/);
    expect(mobileLayout).toMatch(/max-width:\s*100%/);
    expect(mobileLayout).toMatch(/\.archiveMobileScroll[\s\S]*min-width:\s*0/);
    expect(mobileLayout).toMatch(/\.detailColumn[\s\S]*min-width:\s*0/);
  });

  test("dedicated mobile shell uses sticky toolbar and hides desktop back button", () => {
    const css = readCss("src/styles/LearnMore.module.css");
    const mobileBlock = css.match(/@media \(max-width: 720px\)[\s\S]*?(?=@media \(prefers-reduced-motion)/)?.[0] ?? "";
    expect(mobileBlock).toMatch(/\.mobileToolbar[\s\S]*position:\s*sticky/);
    expect(mobileBlock).toMatch(/\.backButtonDesktop[\s\S]*display:\s*none/);
    expect(mobileBlock).toMatch(/\.introLeadMobile[\s\S]*display:\s*block/);
    expect(mobileBlock).toMatch(/\.detailPanel[\s\S]*overflow:\s*visible/);
    expect(mobileBlock).toMatch(/\.primaryBtn[\s\S]*width:\s*100%/);
  });

  test("experience component exposes mobile toolbar markup", () => {
    const source = readSource("src/components/learnMore/LearnMoreExperience.jsx");
    expect(source).toMatch(/mobileToolbar/);
    expect(source).toMatch(/mobileBackButton/);
    expect(source).toMatch(/backButtonDesktop/);
    expect(source).toMatch(/introLeadMobile/);
  });

  test("desktop intro and back button classes remain in stylesheet", () => {
    const css = readCss("src/styles/LearnMore.module.css");
    expect(css).toMatch(/\.backButtonDesktop[\s\S]*display:\s*inline-flex/);
    expect(css).toMatch(/\.introLead\s*\{/);
    expect(css).toMatch(/grid-template-columns:\s*minmax\(220px,\s*260px\)\s*minmax\(0,\s*1fr\)/);
  });
});
