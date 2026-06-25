import { chromium, devices } from "playwright";

/**
 * Launch Chromium for QA scripts. Caller must close browser.
 * @param {{ headless?: boolean }} [opts]
 */
export async function launchBrowser(opts = {}) {
  return chromium.launch({ headless: opts.headless !== false });
}

/** Track page errors for reporting. */
export function attachPageDiagnostics(page, bucket) {
  page.on("pageerror", (err) => {
    bucket.pageErrors.push({ message: err.message, stack: err.stack });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      bucket.consoleErrors.push(msg.text());
    }
  });
}

/** Signed-out homepage smoke — nav, hero, search affordances. */
export async function smokeHomeSignedOut(page, baseUrl) {
  const results = { pass: true, checks: [] };
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);

  const checks = [
    ["brand link", () => page.getByRole("link", { name: /BelizeListings/i }).isVisible()],
    ["hero headline", () => page.getByRole("heading", { level: 1 }).isVisible()],
    ["search input", () => page.getByRole("searchbox").isVisible()],
    ["favorites nav", () => page.getByRole("link", { name: /Favorites/i }).isVisible()],
  ];

  for (const [name, fn] of checks) {
    let ok = false;
    try {
      ok = await fn();
    } catch {
      ok = false;
    }
    results.checks.push({ name, ok });
    if (!ok) results.pass = false;
  }
  return results;
}

/** Basic accessibility snapshot via Playwright roles (no extra deps). */
export async function a11yRoleAudit(page) {
  const issues = [];
  const buttons = await page.locator("button").all();
  for (const btn of buttons.slice(0, 40)) {
    const label =
      (await btn.getAttribute("aria-label")) ||
      (await btn.textContent())?.trim() ||
      "";
    if (!label) {
      const visible = await btn.isVisible().catch(() => false);
      if (visible) issues.push("Unlabeled visible button");
    }
  }
  const images = await page.locator("img:not([alt])").count();
  if (images > 0) issues.push(`${images} img without alt`);
  return { issueCount: issues.length, issues: issues.slice(0, 10) };
}

/** Skip signed-in block gracefully when credentials missing. */
export function signedInSkipMessage() {
  return "Skipping signed-in QA — set QA_EMAIL and QA_PASSWORD to enable.";
}

/** iPhone 12 device preset for mobile emulation. */
export function iphone12Context(browser) {
  return browser.newContext({
    ...devices["iPhone 12"],
    viewport: { width: 390, height: 844 },
  });
}
