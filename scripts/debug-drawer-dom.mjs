import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const env = readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = new URL(url).hostname.split(".")[0];
const storageKey = `sb-${ref}-auth-token`;
const session = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
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

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push({ message: err.message, stack: err.stack }));

await page.route("**/*", async (route) => {
  const u = route.request().url();
  if (u.includes("/auth/v1/")) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
  }
  if (u.includes("/rest/v1/")) {
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  }
  return route.continue();
});

await page.addInitScript(({ key, session: s }) => {
  localStorage.setItem(key, JSON.stringify(s));
}, { key: storageKey, session });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);

await page.getByRole("button", { name: /^Account$/i }).click();
await page.waitForTimeout(1200);

const dom = await page.evaluate(() => {
  const drawer = document.getElementById("site-nav-mobile-drawer");
  const backdrop = document.querySelector('[class*="mobileDrawerBackdrop"]');
  return {
    drawerExists: !!drawer,
    drawerRect: drawer ? drawer.getBoundingClientRect().toJSON() : null,
    drawerStyle: drawer
      ? {
          display: getComputedStyle(drawer).display,
          opacity: getComputedStyle(drawer).opacity,
          visibility: getComputedStyle(drawer).visibility,
          transform: getComputedStyle(drawer).transform,
          zIndex: getComputedStyle(drawer).zIndex,
        }
      : null,
    backdropExists: !!backdrop,
    accountExpanded: document.querySelector('button[aria-controls="site-nav-mobile-drawer"]')?.getAttribute("aria-expanded"),
    errorBoundary: document.body.innerText.includes("Something paused this screen"),
    innerText: drawer?.innerText?.slice(0, 300) || null,
  };
});

console.log(JSON.stringify({ dom, pageErrors }, null, 2));
await page.screenshot({ path: "qa-screenshots/account-drawer-fix/debug-after-click.png", fullPage: false });
await browser.close();
