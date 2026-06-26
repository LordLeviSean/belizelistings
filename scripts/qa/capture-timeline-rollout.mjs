#!/usr/bin/env node
/**
 * Property History timeline QA screenshots — desktop + mobile.
 * Usage: node scripts/qa/capture-timeline-rollout.mjs [listingId]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const listingId = process.argv[2] || "86";
const OUT = join("qa-screenshots", "event-engine-rollout");

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const paths = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const url = `${BASE.replace(/\/$/, "")}/listing/${listingId}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    const timelineBtn = page.getByRole("button", { name: /property history/i });
    await timelineBtn.waitFor({ state: "visible", timeout: 15000 });

    const collapsed = join(OUT, `${vp.name}-timeline-collapsed.png`);
    await page.screenshot({ path: collapsed, fullPage: false });
    paths.push(collapsed);

    await timelineBtn.click();
    await page.waitForTimeout(1500);

    const expanded = join(OUT, `${vp.name}-timeline-expanded.png`);
    await page.screenshot({ path: expanded, fullPage: false });
    paths.push(expanded);

    await page.close();
    console.log(JSON.stringify({ viewport: vp.name, url, paths: [collapsed, expanded], console_errors: errors }, null, 2));
  }

  await browser.close();
  console.log("\nScreenshots saved under", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
