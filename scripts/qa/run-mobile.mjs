#!/usr/bin/env node
/**
 * Mobile QA — signed-out smoke at key phone widths + drawer DOM checks when mock auth available.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { QA_BASE_URL, MOBILE_VIEWPORTS, timestampDir } from "./config.mjs";
import {
  launchBrowser,
  attachPageDiagnostics,
  smokeHomeSignedOut,
  a11yRoleAudit,
} from "./helpers.mjs";

const outDir = join("qa-screenshots", "qa-runs", timestampDir());
mkdirSync(outDir, { recursive: true });

const bucket = { pageErrors: [], consoleErrors: [] };
const report = { suite: "qa:mobile", base: QA_BASE_URL, viewports: [], a11y: [], pass: true };

const browser = await launchBrowser();
try {
  for (const vp of MOBILE_VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    attachPageDiagnostics(page, bucket);

    const smoke = await smokeHomeSignedOut(page, QA_BASE_URL);
    const a11y = await a11yRoleAudit(page);
    const shot = join(outDir, `mobile-${vp.name}-${vp.width}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const entry = { viewport: vp, smoke, a11y, screenshot: shot };
    report.viewports.push(entry);
    if (!smoke.pass) report.pass = false;
    if (a11y.issueCount > 0) report.a11y.push({ viewport: vp.name, ...a11y });

    await context.close();
  }
} finally {
  await browser.close();
}

report.pageErrors = bucket.pageErrors;
report.consoleErrors = bucket.consoleErrors.slice(0, 20);
if (bucket.pageErrors.length) report.pass = false;

const reportPath = join(outDir, "mobile-report.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, reportPath, viewports: report.viewports.length }, null, 2));
process.exitCode = report.pass ? 0 : 1;
