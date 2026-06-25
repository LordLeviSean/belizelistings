import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3002";
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
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /^Account$/i }).click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(500);

// Early click before isMobileNav effect
const earlyErrors = [...pageErrors];

await page.waitForTimeout(2000);
await page.getByRole("button", { name: /^Account$/i }).click().catch(() => {});
await page.waitForTimeout(800);

const notifications = page.getByRole("button", { name: /^Notifications/i });
if (await notifications.isVisible().catch(() => false)) {
  await notifications.click();
  await page.waitForTimeout(800);
}

console.log(
  JSON.stringify(
    {
      base: BASE,
      earlyErrors,
      allErrors: pageErrors,
      errorBoundary: await page.getByRole("heading", { name: /Something paused/i }).isVisible().catch(() => false),
    },
    null,
    2
  )
);

await browser.close();
