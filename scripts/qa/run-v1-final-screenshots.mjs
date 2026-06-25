#!/usr/bin/env node
/**
 * V1.0 final polish — 390px map breathing room + map-to-featured transition.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT = join("qa-screenshots", "v1-final");
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

  const mapSection = page.locator('section[aria-label="Explore by district"]');
  if (await mapSection.isVisible()) {
    const box = await mapSection.boundingBox();
    if (box) {
      await page.screenshot({
        path: join(OUT, "map-section-breathing-390.png"),
        clip: { x: 0, y: Math.max(0, box.y - 12), width: 390, height: Math.min(844, box.height + 24) },
      });
    }
  }

  const featured = page.locator('section[aria-label="Featured listings"]');
  if (await featured.isVisible()) {
    await featured.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const mapBox = await mapSection.boundingBox();
    const featBox = await featured.boundingBox();
    if (mapBox && featBox) {
      const y = Math.max(0, mapBox.y + mapBox.height - 48);
      const height = Math.min(844, featBox.y + featBox.height + 24 - y);
      await page.screenshot({
        path: join(OUT, "map-to-featured-390.png"),
        clip: { x: 0, y, width: 390, height },
      });
    }
  }

  await ctx.close();
  console.log(JSON.stringify({ ok: true, out: OUT }, null, 2));
} finally {
  await browser.close();
}
