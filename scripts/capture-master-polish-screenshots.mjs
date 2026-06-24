import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT_DIR = "qa-screenshots/master-polish";
const QA_EMAIL = process.env.QA_EMAIL || "";
const QA_PASSWORD = process.env.QA_PASSWORD || "";

const SEA_FLOW_MODE_KEY = "blz_sea_flow_mode_v1";
const SEA_FLOW_INTENSITY_KEY = "blz_sea_flow_intensity_v1";

async function enableSeaFlow(page, intensity) {
  await page.evaluate(
    ({ modeKey, intensityKey, value }) => {
      window.localStorage.setItem(modeKey, "1");
      window.localStorage.setItem(intensityKey, String(value));
      window.dispatchEvent(
        new CustomEvent("blz-sea-flow-mode-change", { detail: { enabled: true } })
      );
      window.dispatchEvent(
        new CustomEvent("blz-sea-flow-intensity-change", { detail: { intensity: value } })
      );
    },
    { modeKey: SEA_FLOW_MODE_KEY, intensityKey: SEA_FLOW_INTENSITY_KEY, value: intensity }
  );
}

async function disableSeaFlow(page) {
  await page.evaluate(
    ({ modeKey }) => {
      window.localStorage.setItem(modeKey, "0");
      window.dispatchEvent(
        new CustomEvent("blz-sea-flow-mode-change", { detail: { enabled: false } })
      );
    },
    { modeKey: SEA_FLOW_MODE_KEY }
  );
}

async function tryLogin(page) {
  if (!QA_EMAIL || !QA_PASSWORD) {
    console.warn("QA_EMAIL / QA_PASSWORD not set — skipping signed-in captures");
    return false;
  }
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill('input[type="email"]', QA_EMAIL);
  await page.fill('input[type="password"]', QA_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return !page.url().includes("/login");
}

async function captureNav(page, { width, height, signedIn, openAccount }) {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);

  if (openAccount && signedIn) {
    const accountBtn = page.getByRole("button", { name: /^Account$/i });
    if (await accountBtn.isVisible().catch(() => false)) {
      await accountBtn.click();
      await page.waitForTimeout(600);
    }
  }

  const tag = signedIn ? "signed-in" : "signed-out";
  const accountSuffix = openAccount ? "-account-open" : "";
  const name = width <= 420 ? `mobile-${tag}${accountSuffix}-${width}` : `desktop-${tag}-${width}`;
  const path = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`saved ${path}`);
}

async function captureHero(page, width) {
  await page.setViewportSize({ width, height: width <= 768 ? 900 : 900 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  const path = `${OUT_DIR}/hero-${width}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`saved ${path}`);
}

async function captureSeaFlow(page, label, intensity) {
  await page.setViewportSize({ width: 1440, height: 900 });
  if (intensity === "off") {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
    await disableSeaFlow(page);
  } else {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
    await enableSeaFlow(page, Number(intensity));
  }
  await page.waitForTimeout(1400);
  const path = `${OUT_DIR}/seaflow-${label}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`saved ${path}`);
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

for (const width of [390, 414]) {
  await captureNav(page, { width, height: 844, signedIn: false, openAccount: false });
}

for (const width of [390, 768, 1440]) {
  await captureHero(page, width);
}

for (const [label, value] of [
  ["off", "off"],
  ["25", 0.25],
  ["50", 0.5],
  ["75", 0.75],
  ["100", 1],
]) {
  await captureSeaFlow(page, label, value);
}

const signedIn = await tryLogin(page);
if (signedIn) {
  for (const width of [390, 414]) {
    await captureNav(page, { width, height: 844, signedIn: true, openAccount: false });
    await captureNav(page, { width, height: 844, signedIn: true, openAccount: true });
  }
  await captureNav(page, { width: 1440, height: 900, signedIn: true, openAccount: false });
} else {
  await captureNav(page, { width: 1440, height: 900, signedIn: false, openAccount: false });
}

await browser.close();
