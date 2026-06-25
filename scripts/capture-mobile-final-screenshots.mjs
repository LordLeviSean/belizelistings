import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT_DIR = "qa-screenshots/mobile-final";
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
page.on("pageerror", (err) => pageErrors.push({ message: err.message }));
page.on("console", (msg) => {
  if (msg.type() === "error") pageErrors.push({ console: msg.text() });
});

async function setupMockAuth() {
  if (!storageKey) return;
  await page.route("**/*", async (route) => {
    const u = route.request().url();
    if (u.includes("/auth/v1/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION.user),
      });
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

async function gotoHome() {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2200);
}

const report = { base: BASE, shots: {}, checks: {}, pageErrors };

await page.setViewportSize({ width: 390, height: 844 });
await gotoHome();
report.shots.signedOut = `${OUT_DIR}/mobile-signed-out-390.png`;
await page.screenshot({ path: report.shots.signedOut, fullPage: false });

report.shots.firstScreen = `${OUT_DIR}/first-screen-390.png`;
await page.screenshot({ path: report.shots.firstScreen, fullPage: false });

const mapSection = page.locator('[aria-label="Explore by district"]');
report.checks.mapSectionVisible = await mapSection.isVisible().catch(() => false);

const mapPane = page.locator('[aria-label="Explore by district"] [class*="mapPane"]').first();
const mapBox = await mapPane.boundingBox().catch(() => null);
report.checks.mapHeight = mapBox?.height ?? null;

await mapSection.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
report.shots.mapSection = `${OUT_DIR}/map-section-390.png`;
await page.screenshot({ path: report.shots.mapSection, fullPage: false });

const featured = page.getByRole("heading", { name: /Featured listings/i });
await featured.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
report.shots.featuredTransition = `${OUT_DIR}/featured-transition-390.png`;
await page.screenshot({ path: report.shots.featuredTransition, fullPage: false });

report.checks.featuredBelowMap = await page.evaluate(() => {
  const map = document.querySelector("[aria-label='Explore by district']");
  const featured = [...document.querySelectorAll("h2")].find((h) => /Featured/i.test(h.textContent));
  if (!map || !featured) return false;
  const docBottom = (el) => el.getBoundingClientRect().bottom + window.scrollY;
  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  return docTop(featured) >= docBottom(map) - 2;
});

await setupMockAuth();
await gotoHome();
report.shots.signedIn = `${OUT_DIR}/mobile-signed-in-390.png`;
await page.screenshot({ path: report.shots.signedIn, fullPage: false });

const accountBtn = page.getByRole("button", { name: /^Account$/i });
if (await accountBtn.isVisible().catch(() => false)) {
  await accountBtn.click();
  await page.waitForTimeout(1200);
  report.shots.accountDrawer = `${OUT_DIR}/account-drawer-open-390.png`;
  await page.screenshot({ path: report.shots.accountDrawer, fullPage: false });
  report.checks.drawerVisible = await page.locator("#site-nav-mobile-drawer").isVisible().catch(() => false);
}

for (const width of [393, 414, 430]) {
  await page.setViewportSize({ width, height: 844 });
  await gotoHome();
  report.checks[`viewport_${width}`] = await mapSection.isVisible().catch(() => false);
}

console.log(JSON.stringify(report, null, 2));
await browser.close();

const failed =
  pageErrors.length > 0 ||
  !report.checks.mapSectionVisible ||
  !report.checks.featuredBelowMap;

if (failed) process.exitCode = 1;
