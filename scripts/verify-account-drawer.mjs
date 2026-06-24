import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);

const loginVisible = await page.getByRole("button", { name: /^Login$/i }).isVisible().catch(() => false);
const accountVisible = await page.getByRole("button", { name: /^Account$/i }).isVisible().catch(() => false);

console.log(JSON.stringify({ loginVisible, accountVisible, errors }, null, 2));

if (accountVisible) {
  await page.getByRole("button", { name: /^Account$/i }).click();
  await page.waitForTimeout(800);
  const drawer = await page.locator("#site-nav-mobile-drawer").isVisible().catch(() => false);
  console.log(JSON.stringify({ drawerOpen: drawer, errorsAfterClick: errors }, null, 2));
}

await browser.close();
