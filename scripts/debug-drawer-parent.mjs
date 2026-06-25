import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const env = readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = new URL(url).hostname.split(".")[0];
const storageKey = `sb-${ref}-auth-token`;
const session = {
  access_token: "mock",
  refresh_token: "mock",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: {
    id: "11111111-1111-1111-1111-111111111111",
    email: "qa@test.com",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  },
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route("**/*", async (route) => {
  const u = route.request().url();
  if (u.includes("/auth/v1/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
  if (u.includes("/rest/v1/")) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  return route.continue();
});
await page.addInitScript(({ key, session: s }) => localStorage.setItem(key, JSON.stringify(s)), { key: storageKey, session });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: /^Account$/i }).click();
await page.waitForTimeout(1000);
const info = await page.evaluate(() => {
  const drawer = document.getElementById("site-nav-mobile-drawer");
  const navHeight = getComputedStyle(document.documentElement).getPropertyValue("--site-nav-height");
  return {
    parentTag: drawer?.parentElement?.tagName,
    parentId: drawer?.parentElement?.id,
    bodyChild: drawer?.parentElement === document.body,
    navHeight,
    rect: drawer?.getBoundingClientRect(),
    computedTop: drawer ? getComputedStyle(drawer).top : null,
    computedBottom: drawer ? getComputedStyle(drawer).bottom : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
