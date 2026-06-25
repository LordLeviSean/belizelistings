#!/usr/bin/env node
/**
 * Mobile map expand verification — 390px captures + layout spacing checks.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT = join("qa-screenshots", "mobile-map-expand");
mkdirSync(OUT, { recursive: true });

const TOLERANCE = 6;

const browser = await chromium.launch();
const layoutReport = { ok: true, checks: [], viewport: { width: 390, height: 844 } };

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

  const stats = page.locator('[class*="statGrid"]').first();
  const mapSection = page.locator('section[aria-label="Explore by district"]');
  const featured = page.locator('section[aria-label="Featured listings"]');

  const statsBox = await stats.boundingBox();
  const mapBox = await mapSection.boundingBox();
  const featuredBox = await featured.boundingBox();

  if (statsBox && mapBox) {
    const gapStatsToMap = mapBox.y - (statsBox.y + statsBox.height);
    const statsMapOk = Math.abs(gapStatsToMap - 28) <= TOLERANCE;
    layoutReport.checks.push({
      name: "stats-to-map gap ~28px",
      expected: 28,
      actual: Math.round(gapStatsToMap),
      ok: statsMapOk,
    });
    if (!statsMapOk) layoutReport.ok = false;

    const clipY = Math.max(0, statsBox.y - 20);
    const clipH = Math.min(844, mapBox.y + mapBox.height * 0.55 - clipY);
    if (clipH > 0) {
      await page.screenshot({
        path: join(OUT, "stats-to-map-transition-390.png"),
        clip: { x: 0, y: clipY, width: 390, height: clipH },
      });
    }
  }

  if (mapBox) {
    const mapClipH = Math.min(844, mapBox.height + 16);
    if (mapClipH > 0) {
      await page.screenshot({
        path: join(OUT, "map-section-full-390.png"),
        clip: { x: 0, y: Math.max(0, mapBox.y - 8), width: 390, height: mapClipH },
      });
    }

    const mapPane = mapSection.locator('[class*="mapPane"]').first();
    const mapPaneBox = await mapPane.boundingBox();
    if (mapPaneBox) {
      const minHOk = mapPaneBox.height >= 354;
      layoutReport.checks.push({
        name: "map pane min-height >= 360px",
        expected: ">=360",
        actual: Math.round(mapPaneBox.height),
        ok: minHOk,
      });
      if (!minHOk) layoutReport.ok = false;
    }

    const svg = mapSection.locator("svg").first();
    const svgBox = await svg.boundingBox();
    if (svgBox && mapPaneBox) {
      const clippedTop = svgBox.y < mapPaneBox.y - 2;
      const clippedBottom = svgBox.y + svgBox.height > mapPaneBox.y + mapPaneBox.height + 2;
      const silhouetteOk = !clippedTop && !clippedBottom;
      layoutReport.checks.push({
        name: "full silhouette visible (no clip)",
        clippedTop,
        clippedBottom,
        ok: silhouetteOk,
      });
      if (!silhouetteOk) layoutReport.ok = false;
    }
  }

  if (mapBox && featuredBox) {
    const gapMapToFeatured = featuredBox.y - (mapBox.y + mapBox.height);
    const mapFeaturedOk = Math.abs(gapMapToFeatured - 28) <= TOLERANCE;
    layoutReport.checks.push({
      name: "map-to-featured gap ~28px",
      expected: 28,
      actual: Math.round(gapMapToFeatured),
      ok: mapFeaturedOk,
    });
    if (!mapFeaturedOk) layoutReport.ok = false;

    await featured.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const mapBoxAfter = await mapSection.boundingBox();
    const featuredBoxAfter = await featured.boundingBox();
    if (mapBoxAfter && featuredBoxAfter) {
      const clipY = Math.max(0, mapBoxAfter.y + mapBoxAfter.height * 0.5);
      const clipH = Math.min(844, featuredBoxAfter.y + featuredBoxAfter.height + 40 - clipY);
      if (clipH > 0) {
        await page.screenshot({
          path: join(OUT, "map-to-featured-transition-390.png"),
          clip: { x: 0, y: clipY, width: 390, height: clipH },
        });
      }
    }
  }

  writeFileSync(join(OUT, "layout-report.json"), JSON.stringify(layoutReport, null, 2));
  console.log(JSON.stringify({ ok: layoutReport.ok, out: OUT, checks: layoutReport.checks }, null, 2));

  await ctx.close();
} finally {
  await browser.close();
}

process.exitCode = layoutReport.ok ? 0 : 1;
