import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT_DIR = "qa-screenshots/account-drawer-fix";

function getSupabaseRef() {
  const env = readFileSync(".env.local", "utf8");
  const match = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
  if (!match) throw new Error("missing supabase url");
  const url = match[1].trim().replace(/^["']|["']$/g, "");
  return new URL(url).hostname.split(".")[0];
}

const MOCK_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "qa-drawer-test@belizelistings.test",
  role: "authenticated",
  app_metadata: {},
  user_metadata: { username: "qatest" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const MOCK_SESSION = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: MOCK_USER,
};

mkdirSync(OUT_DIR, { recursive: true });

const supabaseRef = getSupabaseRef();
const storageKey = `sb-${supabaseRef}-auth-token`;

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const pageErrors = [];
page.on("pageerror", (err) => {
  pageErrors.push({ message: err.message, stack: err.stack || "" });
});

await page.route("**/*", async (route) => {
  const url = route.request().url();
  if (url.includes("/auth/v1/user") || url.includes("/auth/v1/token")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER),
    });
  }
  if (url.includes("/rest/v1/profiles") || url.includes("/rest/v1/listings")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  }
  if (url.includes("/rest/v1/agent_upgrade_requests")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  }
  return route.continue();
});

await page.addInitScript(({ key, session }) => {
  window.localStorage.setItem(key, JSON.stringify(session));
}, { key: storageKey, session: MOCK_SESSION });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

const accountVisible = await page.getByRole("button", { name: /^Account$/i }).isVisible().catch(() => false);
console.log("accountVisible", accountVisible);

if (accountVisible) {
  const before = pageErrors.length;
  await page.getByRole("button", { name: /^Account$/i }).click();
  await page.waitForTimeout(1500);

  const report = {
    drawerVisible: await page.locator("#site-nav-mobile-drawer").isVisible().catch(() => false),
    errorBoundary: await page.getByRole("heading", { name: /Something paused this screen/i }).isVisible().catch(() => false),
    dashboardBtn: await page.getByRole("button", { name: /^Dashboard$/i }).isVisible().catch(() => false),
    notificationsBtn: await page.getByRole("button", { name: /^Notifications/i }).isVisible().catch(() => false),
    logoutBtn: await page.getByRole("button", { name: /^Logout$/i }).isVisible().catch(() => false),
    newErrors: pageErrors.slice(before),
  };
  console.log(JSON.stringify(report, null, 2));
  await page.screenshot({ path: `${OUT_DIR}/mobile-account-open-390-mock.png`, fullPage: false });
} else {
  console.log("Account not visible — auth mock may have failed");
  console.log("pageErrors", pageErrors);
}

await browser.close();

if (pageErrors.length) process.exitCode = 1;
