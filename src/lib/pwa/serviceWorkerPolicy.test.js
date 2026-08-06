/** @jest-environment node */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const SW_PATH = path.join(ROOT, "public", "sw.js");
const APP_PATH = path.join(ROOT, "src", "pages", "_app.js");
const REGISTER_PATH = path.join(ROOT, "src", "lib", "pwa", "registerServiceWorker.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

describe("BelizeListings service worker safety policy", () => {
  let swSource;

  beforeAll(() => {
    swSource = read(SW_PATH);
  });

  test("service worker file exists at public/sw.js", () => {
    expect(fs.existsSync(SW_PATH)).toBe(true);
    expect(swSource.trim().length).toBeGreaterThan(0);
  });

  test("does not precache or write runtime caches", () => {
    expect(swSource).not.toMatch(/caches\.open\s*\(/);
    expect(swSource).not.toMatch(/cache\.put\s*\(/);
    expect(swSource).not.toMatch(/cache\.add(All)?\s*\(/);
    expect(swSource).not.toMatch(/workbox/i);
  });

  test("does not intercept fetch or serve offline fallbacks", () => {
    expect(swSource).not.toMatch(/addEventListener\s*\(\s*['"]fetch['"]/);
    expect(swSource).not.toMatch(/respondWith\s*\(/);
    expect(swSource).not.toMatch(/return\s+Response\s*\(/);
  });

  test("does not force skipWaiting or client reload loops", () => {
    expect(swSource).not.toMatch(/self\.skipWaiting\s*\(/);
    expect(swSource).not.toMatch(/clients\.claim\s*\(/);
    expect(swSource).not.toMatch(/location\.reload\s*\(/);
  });

  test("cache cleanup is limited to belizelistings-sw prefix", () => {
    expect(swSource).toMatch(/belizelistings-sw/);
    expect(swSource).toMatch(/startsWith\s*\(\s*CACHE_PREFIX\s*\)/);
    expect(swSource).not.toMatch(/caches\.delete\s*\(\s*['"][^'"]+['"]\s*\)/);
  });

  test("application shell registers the service worker once", () => {
    const appSource = read(APP_PATH);
    expect(appSource).toContain("registerBelizeListingsServiceWorker");
    expect(appSource).toMatch(/useEffect\s*\(/);
  });

  test("registration module targets /sw.js with root scope", () => {
    const registerSource = read(REGISTER_PATH);
    expect(registerSource).toContain('SERVICE_WORKER_URL = "/sw.js"');
    expect(registerSource).toContain('SERVICE_WORKER_SCOPE = "/"');
    expect(registerSource).toMatch(/scope:\s*SERVICE_WORKER_SCOPE/);
    expect(registerSource).toMatch(/catch\s*\(/);
  });
});
