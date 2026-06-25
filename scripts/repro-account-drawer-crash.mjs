import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT_DIR = "qa-screenshots/account-drawer-fix";

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
const QA_EMAIL =
  process.env.QA_EMAIL || envLocal.QA_EMAIL || envLocal.NEXT_PUBLIC_QA_EMAIL || envLocal.TEST_EMAIL || "";
const QA_PASSWORD =
  process.env.QA_PASSWORD || envLocal.QA_PASSWORD || envLocal.TEST_PASSWORD || "";

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

const pageErrors = [];
const consoleErrors = [];

page.on("pageerror", (err) => {
  pageErrors.push({
    message: err.message,
    stack: err.stack || "",
  });
});

page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(msg.text());
  }
});

async function tryLogin() {
  if (!QA_EMAIL || !QA_PASSWORD) {
    return { ok: false, reason: "missing_credentials" };
  }
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  if (!(await emailInput.count())) {
    return { ok: false, reason: "no_email_input" };
  }

  await emailInput.first().fill(QA_EMAIL);
  await passwordInput.first().fill(QA_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
  const url = page.url();
  return { ok: !url.includes("/login"), url };
}

async function testViewport(width) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  const accountBtn = page.getByRole("button", { name: /^Account$/i });
  const accountVisible = await accountBtn.isVisible().catch(() => false);
  if (!accountVisible) {
    return { width, accountVisible: false };
  }

  const beforeErrors = pageErrors.length;
  await accountBtn.click();
  await page.waitForTimeout(1200);

  const drawerVisible = await page.locator("#site-nav-mobile-drawer").isVisible().catch(() => false);
  const errorBoundary = await page.getByRole("heading", { name: /Something paused this screen/i }).isVisible().catch(() => false);
  const dashboardBtn = await page.getByRole("button", { name: /^Dashboard$/i }).isVisible().catch(() => false);
  const notificationsBtn = await page.getByRole("button", { name: /^Notifications/i }).isVisible().catch(() => false);
  const logoutBtn = await page.getByRole("button", { name: /^Logout$/i }).isVisible().catch(() => false);

  const shot = `${OUT_DIR}/mobile-account-open-${width}.png`;
  await page.screenshot({ path: shot, fullPage: false });

  return {
    width,
    accountVisible,
    drawerVisible,
    errorBoundary,
    dashboardBtn,
    notificationsBtn,
    logoutBtn,
    screenshot: shot,
    newPageErrors: pageErrors.slice(beforeErrors),
  };
}

const loginResult = await tryLogin();
const results = [];

for (const width of [390, 414]) {
  results.push(await testViewport(width));
}

const report = {
  base: BASE,
  login: loginResult,
  pageErrors,
  consoleErrors: consoleErrors.slice(0, 20),
  results,
};

console.log(JSON.stringify(report, null, 2));
await browser.close();

if (results.some((r) => r.errorBoundary || r.newPageErrors?.length)) {
  process.exitCode = 1;
}
