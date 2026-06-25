import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const env = readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, "");
const ref = new URL(url).hostname.split(".")[0];
const storageKey = `sb-${ref}-auth-token`;
const userId = "11111111-1111-1111-1111-111111111111";
const session = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: {
    id: userId,
    email: "admin@test.com",
    role: "authenticated",
    app_metadata: {},
    user_metadata: { username: "adminqa" },
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
  if (u.includes("/rest/v1/profiles")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: userId, email: session.user.email, role: "admin", username: "adminqa" }]),
    });
  }
  if (u.includes("/rest/v1/listings") && route.request().method() === "HEAD") {
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/3" }, body: "" });
  }
  if (u.includes("/rest/v1/listings")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "1", title: "Test", user_id: userId, lifecycle_status: "pending", status: "pending", moderation_status: "pending_review", updated_at: new Date().toISOString() },
      ]),
    });
  }
  if (u.includes("/rest/v1/agent_upgrade_requests")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "up-1",
          user_id: "22222222-2222-2222-2222-222222222222",
          username: "agent1",
          email: "agent1@test.com",
          requested_at: new Date().toISOString(),
          status: "pending",
        },
      ]),
    });
  }
  return route.continue();
});

await page.addInitScript(({ key, session: s }) => {
  localStorage.setItem(key, JSON.stringify(s));
}, { key: storageKey, session });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3500);
await page.getByRole("button", { name: /^Account$/i }).click();
await page.waitForTimeout(2000);

console.log(
  JSON.stringify(
    {
      pageErrors,
      errorBoundary: await page.getByRole("heading", { name: /Something paused/i }).isVisible().catch(() => false),
      drawerHeight: await page.evaluate(() => document.getElementById("site-nav-mobile-drawer")?.getBoundingClientRect().height ?? null),
    },
    null,
    2
  )
);

await browser.close();
