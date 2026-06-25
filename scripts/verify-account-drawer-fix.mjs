import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3003";
const OUT_DIR = "qa-screenshots/account-drawer-fix";
mkdirSync(OUT_DIR, { recursive: true });

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
  if (u.includes("/auth/v1/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
  if (u.includes("/rest/v1/")) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  return route.continue();
});
await page.addInitScript(({ key, session: s }) => localStorage.setItem(key, JSON.stringify(s)), { key: storageKey, session });

const results = [];
for (const width of [390, 414]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const before = pageErrors.length;
  await page.getByRole("button", { name: /^Account$/i }).click();
  await page.waitForTimeout(1200);
  const shot = `${OUT_DIR}/mobile-account-open-${width}.png`;
  await page.screenshot({ path: shot, fullPage: false });
  results.push({
    width,
    drawerHeight: await page.evaluate(() => document.getElementById("site-nav-mobile-drawer")?.getBoundingClientRect().height ?? null),
    drawerOnBody: await page.evaluate(() => document.getElementById("site-nav-mobile-drawer")?.parentElement === document.body),
    dashboardBtn: await page.getByRole("button", { name: /^Dashboard$/i }).isVisible(),
    notificationsBtn: await page.getByRole("button", { name: /^Notifications/i }).isVisible(),
    logoutBtn: await page.getByRole("button", { name: /^Logout$/i }).isVisible(),
    errorBoundary: await page.getByRole("heading", { name: /Something paused/i }).isVisible().catch(() => false),
    screenshot: shot,
    newErrors: pageErrors.slice(before),
  });
}

console.log(JSON.stringify({ base: BASE, pageErrors, results }, null, 2));
await browser.close();
if (pageErrors.length || results.some((r) => r.errorBoundary || r.newErrors?.length || !r.drawerOnBody || (r.drawerHeight ?? 0) < 100)) {
  process.exitCode = 1;
}
