import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT_DIR = "qa-screenshots";

const VIEWPORTS = [
  { name: "mobile-fix-390", width: 390, height: 844 },
  { name: "mobile-fix-414", width: 414, height: 896 },
  { name: "mobile-fix-768", width: 768, height: 1024 },
  { name: "mobile-fix-1440", width: 1440, height: 900 },
];

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: `${OUT_DIR}/${vp.name}.png`,
    fullPage: false,
  });
  console.log(`saved ${OUT_DIR}/${vp.name}.png (${vp.width}px)`);
}

await browser.close();
