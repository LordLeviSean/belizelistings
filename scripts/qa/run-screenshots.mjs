#!/usr/bin/env node
/**
 * Visual regression captures — signed out/in, drawer, notifications.
 * Signed-in flows skip gracefully without QA_EMAIL/QA_PASSWORD.
 */
import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  QA_BASE_URL,
  MOBILE_VIEWPORTS,
  DESKTOP_VIEWPORT,
  SCREENSHOT_ROOT,
  hasSignedInCredentials,
  QA_EMAIL,
  QA_PASSWORD,
  timestampDir,
} from "./config.mjs";
import { signedInSkipMessage } from "./helpers.mjs";

const runDir = join(SCREENSHOT_ROOT, timestampDir());
mkdirSync(runDir, { recursive: true });

const manifest = { base: QA_BASE_URL, dir: runDir, shots: [], skipped: [] };

async function capture(page, name) {
  const path = join(runDir, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  manifest.shots.push(path);
  return path;
}

async function mockSignedIn(page) {
  if (!existsSync(".env.local")) return false;
  try {
    const env = readFileSync(".env.local", "utf8");
    const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
    if (!urlMatch) return false;
    const url = urlMatch[1].trim().replace(/^["']|["']$/g, "");
    const ref = new URL(url).hostname.split(".")[0];
    const storageKey = `sb-${ref}-auth-token`;
    const session = {
      access_token: "qa-mock",
      refresh_token: "qa-mock",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "qa@test.com",
        role: "authenticated",
        app_metadata: {},
        user_metadata: { username: "qatest" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    };
    await page.route("**/*", async (route) => {
      const u = route.request().url();
      if (u.includes("/auth/v1/")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(session.user),
        });
      }
      if (u.includes("/rest/v1/")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      return route.continue();
    });
    await page.addInitScript(({ key, session: s }) => {
      localStorage.setItem(key, JSON.stringify(s));
    }, { key: storageKey, session });
    return true;
  } catch {
    return false;
  }
}

const browser = await chromium.launch();
try {
  // Desktop signed out
  {
    const ctx = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    const page = await ctx.newPage();
    await page.goto(`${QA_BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    await capture(page, "desktop-signed-out");
    await ctx.close();
  }

  // Mobile signed out (390, 414)
  for (const w of [390, 414]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${QA_BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    await capture(page, `mobile-${w}-signed-out`);
    await ctx.close();
  }

  // Signed-in + drawer (mock auth for CI/local)
  const ctxIn = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const pageIn = await ctxIn.newPage();
  const mocked = await mockSignedIn(pageIn);
  if (mocked || hasSignedInCredentials()) {
    await pageIn.goto(`${QA_BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await pageIn.waitForTimeout(2500);
    await capture(pageIn, "mobile-390-signed-in");
    const accountBtn = pageIn.getByRole("button", { name: /^Account$/i });
    if (await accountBtn.isVisible().catch(() => false)) {
      await accountBtn.click();
      await pageIn.waitForTimeout(800);
      await capture(pageIn, "mobile-390-account-drawer-open");
      const notifyBtn = pageIn.getByRole("button", { name: /^Notifications/i });
      if (await notifyBtn.isVisible().catch(() => false)) {
        await notifyBtn.click();
        await pageIn.waitForTimeout(600);
        await capture(pageIn, "mobile-390-notifications-open");
      }
    }
  } else {
    manifest.skipped.push(signedInSkipMessage());
  }
  await ctxIn.close();

  if (hasSignedInCredentials()) {
    manifest.note = `Real signed-in capture available via QA_EMAIL (${QA_EMAIL.slice(0, 3)}***) — extend script for prod login if needed.`;
  }
} finally {
  await browser.close();
}

writeFileSync(join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
