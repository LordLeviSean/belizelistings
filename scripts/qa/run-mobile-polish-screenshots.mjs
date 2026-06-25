#!/usr/bin/env node
/**
 * Mobile polish final screenshots — 390px homepage captures for nav, hero, map, featured.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT = join("qa-screenshots", "mobile-polish-final");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);

  await page.screenshot({ path: join(OUT, "first-screen-390.png"), fullPage: false });

  const navbar = page.locator("header").first();
  if (await navbar.isVisible()) {
    await navbar.screenshot({ path: join(OUT, "nav-pills-390.png") });
  }

  const stats = page.locator('[class*="statGrid"]').first();
  if (await stats.isVisible()) {
    const box = await stats.boundingBox();
    if (box) {
      await page.screenshot({
        path: join(OUT, "hero-stats-390.png"),
        clip: { x: 0, y: Math.max(0, box.y - 280), width: 390, height: Math.min(844, box.y + box.height + 40 - Math.max(0, box.y - 280)) },
      });
    }
  }

  const mapSection = page.locator('section[aria-label="Explore by district"]');
  if (await mapSection.isVisible()) {
    const box = await mapSection.boundingBox();
    if (box) {
      await page.screenshot({
        path: join(OUT, "map-section-390.png"),
        clip: { x: 0, y: Math.max(0, box.y - 16), width: 390, height: Math.min(844, box.height + 32) },
      });
    }
  }

  const featured = page.locator('section[aria-label="Featured listings"]');
  if (await featured.isVisible()) {
    await featured.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = await featured.boundingBox();
    if (box) {
      await page.screenshot({
        path: join(OUT, "featured-transition-390.png"),
        clip: { x: 0, y: Math.max(0, box.y - 80), width: 390, height: Math.min(844, box.height + 100) },
      });
    }
  }

  await ctx.close();
  console.log(JSON.stringify({ ok: true, out: OUT }, null, 2));
} finally {
  await browser.close();
}
