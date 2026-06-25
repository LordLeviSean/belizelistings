#!/usr/bin/env node
/**
 * Listing detail mobile polish screenshots — 390px captures for Sprint 2.3B QA.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const LISTING_PATH = process.env.QA_LISTING_PATH || "";
const OUT = join("qa-screenshots", "listing-detail-mobile-2.3b");
mkdirSync(OUT, { recursive: true });

async function resolveListingPath(page) {
  if (LISTING_PATH) return LISTING_PATH.startsWith("/") ? LISTING_PATH : `/${LISTING_PATH}`;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);
  const href = await page.locator('a[href^="/listing/"]').first().getAttribute("href");
  if (!href) throw new Error("No listing link found on homepage — set QA_LISTING_PATH");
  return href;
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const listingPath = await resolveListingPath(page);
  await page.goto(`${BASE}${listingPath}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);

  await page.screenshot({ path: join(OUT, "sticky-bar-mid-page-390.png"), fullPage: false });

  const stickyBar = page.locator('section[aria-label="Contact and scheduling"]');
  if (await stickyBar.isVisible()) {
    await stickyBar.screenshot({ path: join(OUT, "sticky-bar-closeup-390.png") });
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, "footer-no-overlap-390.png"), fullPage: false });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const thumbRow = page.locator('[class*="thumbRowMobile"]').first();
  if (await thumbRow.isVisible()) {
    await thumbRow.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await thumbRow.boundingBox();
    if (box) {
      await page.screenshot({
        path: join(OUT, "gallery-thumbs-390.png"),
        clip: { x: 0, y: Math.max(0, box.y - 120), width: 390, height: Math.min(844, box.height + 200) },
      });
    }
  }

  const about = page.locator("#story-heading");
  if (await about.isVisible()) {
    await about.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = await about.boundingBox();
    if (box) {
      await page.screenshot({
        path: join(OUT, "about-section-390.png"),
        clip: { x: 0, y: Math.max(0, box.y - 48), width: 390, height: Math.min(844, 420) },
      });
    }
  }

  await ctx.close();
  console.log(JSON.stringify({ ok: true, out: OUT, listingPath }, null, 2));
} finally {
  await browser.close();
}
