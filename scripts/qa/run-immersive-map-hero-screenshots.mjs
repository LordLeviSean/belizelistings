#!/usr/bin/env node
/**
 * Immersive mobile map hero — 390/414 initial + scrolled captures + layout checks.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT = join("qa-screenshots", "immersive-map-hero");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "414", width: 414, height: 896 },
];

const browser = await chromium.launch();
const report = { ok: true, viewports: [] };

try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(2500);

    const title = page.getByRole("heading", { level: 1, name: /Living Property Map/i });
    const search = page.getByRole("searchbox");
    const stats = page.locator('[class*="statGrid"]').first();
    const featured = page.locator('section[aria-label="Featured listings"]');
    const mapHero = page.locator('[aria-label="Belize property map"]');

    const titleBox = await title.boundingBox();
    const searchBox = await search.boundingBox();
    const statsBox = await stats.boundingBox();
    const featuredBox = await featured.boundingBox().catch(() => null);
    const mapBox = await mapHero.boundingBox();

    const titleBelowFold = titleBox ? titleBox.y >= vp.height - 2 : false;
    const searchBelowFold = searchBox ? searchBox.y >= vp.height - 2 : false;
    const statsBelowFold = statsBox ? statsBox.y >= vp.height - 2 : false;
    const featuredBelowFold = featuredBox ? featuredBox.y >= vp.height - 2 : true;

    const mapFillsViewport =
      mapBox &&
      mapBox.y + mapBox.height >= vp.height - 24 &&
      mapBox.y < vp.height * 0.25;

    const checks = [
      { name: "title hidden on load", ok: titleBelowFold, actual: titleBox?.y },
      { name: "search hidden on load", ok: searchBelowFold, actual: searchBox?.y },
      { name: "stats hidden on load", ok: statsBelowFold, actual: statsBox?.y },
      { name: "featured hidden on load", ok: featuredBelowFold, actual: featuredBox?.y ?? "n/a" },
      { name: "map fills viewport bottom", ok: !!mapFillsViewport, actual: mapBox?.height },
    ];

    for (const c of checks) {
      if (!c.ok) report.ok = false;
    }

    await page.screenshot({
      path: join(OUT, `initial-${vp.name}.png`),
      fullPage: false,
    });

    await page.evaluate(() => window.scrollBy(0, 1));
    await page.waitForTimeout(300);

    const titleVisibleAfterScroll = await title.isVisible();
    await page.screenshot({
      path: join(OUT, `scrolled-${vp.name}.png`),
      fullPage: false,
    });

    await page.evaluate(() => {
      const el = document.querySelector('[class*="heroMapTitle"], h1');
      el?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(OUT, `reveal-${vp.name}.png`),
      fullPage: false,
    });

    report.viewports.push({
      viewport: vp.name,
      checks,
      titleVisibleAfterScroll,
    });

    await ctx.close();
  }

  writeFileSync(join(OUT, "layout-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}

process.exitCode = report.ok ? 0 : 1;
