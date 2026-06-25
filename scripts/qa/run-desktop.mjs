#!/usr/bin/env node
/** Desktop QA — signed-out smoke at 1280px; desktop layout must load. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { QA_BASE_URL, DESKTOP_VIEWPORT, timestampDir } from "./config.mjs";
import { launchBrowser, attachPageDiagnostics, smokeHomeSignedOut, a11yRoleAudit } from "./helpers.mjs";

const outDir = join("qa-screenshots", "qa-runs", timestampDir());
mkdirSync(outDir, { recursive: true });

const bucket = { pageErrors: [], consoleErrors: [] };
const browser = await launchBrowser();

let pass = true;
try {
  const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
  const page = await context.newPage();
  attachPageDiagnostics(page, bucket);

  const smoke = await smokeHomeSignedOut(page, QA_BASE_URL);
  const a11y = await a11yRoleAudit(page);
  const desktopNav = await page.locator('[class*="navLinksDesktop"]').first().isVisible().catch(() => false);

  const shot = join(outDir, "desktop-1280-signed-out.png");
  await page.screenshot({ path: shot, fullPage: false });

  const report = {
    suite: "qa:desktop",
    base: QA_BASE_URL,
    smoke,
    a11y,
    desktopNavVisible: desktopNav,
    screenshot: shot,
    pageErrors: bucket.pageErrors,
  };

  pass = smoke.pass && desktopNav && bucket.pageErrors.length === 0;
  writeFileSync(join(outDir, "desktop-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass, report: join(outDir, "desktop-report.json") }, null, 2));
  await context.close();
} finally {
  await browser.close();
}

process.exitCode = pass ? 0 : 1;
