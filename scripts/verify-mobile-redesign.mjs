import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT_DIR = "qa-screenshots/mobile-redesign";
mkdirSync(OUT_DIR, { recursive: true });

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

const envLocal = loadEnvLocal();
const supabaseUrl = envLocal.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = supabaseUrl ? new URL(supabaseUrl.replace(/^["']|["']$/g, "")).hostname.split(".")[0] : "";
const storageKey = ref ? `sb-${ref}-auth-token` : "";
const MOCK_SESSION = {
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
page.on("pageerror", (err) => pageErrors.push({ message: err.message, stack: err.stack || "" }));
page.on("console", (msg) => {
  if (msg.type() === "error") pageErrors.push({ console: msg.text() });
});

async function setupMockAuth() {
  if (!storageKey) return;
  await page.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.includes("/auth/v1/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SESSION.user) });
    }
    if (u.includes("/rest/v1/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.continue();
  });
  await page.addInitScript(({ key, session }) => {
    window.localStorage.setItem(key, JSON.stringify(session));
  }, { key: storageKey, session: MOCK_SESSION });
}

async function capture(name, width = 390) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2200);
  const path = `${OUT_DIR}/${name}`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

const report = { base: BASE, shots: {}, checks: {}, pageErrors };

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);
report.shots.signedOut390 = `${OUT_DIR}/signed-out-mobile-390.png`;
await page.screenshot({ path: report.shots.signedOut390, fullPage: false });

await page.setViewportSize({ width: 414, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1500);
report.shots.signedOut414 = `${OUT_DIR}/signed-out-mobile-414.png`;
await page.screenshot({ path: report.shots.signedOut414, fullPage: false });

await setupMockAuth();

for (const width of [390, 414]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);

  if (width === 390) {
    report.shots.signedIn390 = `${OUT_DIR}/signed-in-mobile-390.png`;
    await page.screenshot({ path: report.shots.signedIn390, fullPage: false });
  }

  const accountBtn = page.getByRole("button", { name: /^Account$/i });
  if (await accountBtn.isVisible().catch(() => false)) {
    await accountBtn.click();
    await page.waitForTimeout(1200);
    if (width === 390) {
      report.shots.accountMenu390 = `${OUT_DIR}/account-menu-open-390.png`;
      await page.screenshot({ path: report.shots.accountMenu390, fullPage: false });
    }
    report.checks[`drawer_${width}`] = {
      drawerVisible: await page.locator("#site-nav-mobile-drawer").isVisible().catch(() => false),
      dashboardBtn: await page.getByRole("button", { name: /^Dashboard$/i }).isVisible().catch(() => false),
      notificationsBtn: await page.getByRole("button", { name: /^Notifications/i }).isVisible().catch(() => false),
      logoutBtn: await page.getByRole("button", { name: /^Logout$/i }).isVisible().catch(() => false),
      errorBoundary: await page.getByRole("heading", { name: /Something paused/i }).isVisible().catch(() => false),
      drawerHeight: await page.evaluate(() => document.getElementById("site-nav-mobile-drawer")?.getBoundingClientRect().height ?? 0),
    };

    await page.getByRole("button", { name: /^Dashboard$/i }).click();
    await page.waitForTimeout(2000);
    if (width === 390) {
      report.shots.dashboard390 = `${OUT_DIR}/dashboard-390.png`;
      await page.screenshot({ path: report.shots.dashboard390, fullPage: false });
    }

    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: /^Account$/i }).click();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /^Notifications/i }).click();
    await page.waitForTimeout(1000);
    if (width === 390) {
      report.shots.notifications390 = `${OUT_DIR}/notifications-390.png`;
      await page.screenshot({ path: report.shots.notifications390, fullPage: false });
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: /^Logout$/i }).click();
    await page.waitForTimeout(2500);
    if (width === 390) {
      report.shots.logout390 = `${OUT_DIR}/logout-post-logout-390.png`;
      await page.screenshot({ path: report.shots.logout390, fullPage: false });
    }

    await setupMockAuth();
  }
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);
report.shots.featured390 = `${OUT_DIR}/featured-listings-visible-390.png`;
await page.screenshot({ path: report.shots.featured390, fullPage: false });
report.checks.featuredVisible = await page.getByRole("heading", { name: /Featured listings/i }).isVisible().catch(() => false);
report.checks.mapHeight = await page.evaluate(() => {
  const map = document.querySelector('[class*="mapPane"]');
  return map ? map.getBoundingClientRect().height : null;
});

console.log(JSON.stringify(report, null, 2));
await browser.close();

const failed =
  pageErrors.length > 0 ||
  Object.values(report.checks).some((c) => c?.errorBoundary) ||
  (report.checks.drawer_390 && !report.checks.drawer_390.drawerVisible);

if (failed) process.exitCode = 1;
