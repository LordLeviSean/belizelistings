/** @jest-environment node */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PWA_THEME_COLOR } from "./pwaConstants";

const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC = path.join(ROOT, "public");
const MANIFEST_PATH = path.join(PUBLIC, "site.webmanifest");
const DOCUMENT_PATH = path.join(ROOT, "src", "pages", "_document.js");
const PAGE_HEAD_PATH = path.join(ROOT, "src", "components", "PageHead.jsx");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

describe("PWA manifest and install metadata", () => {
  let manifest;

  beforeAll(() => {
    manifest = JSON.parse(readText(MANIFEST_PATH));
  });

  test("site.webmanifest parses as valid JSON with required fields", () => {
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("en");
    expect(manifest.name).toBe("BelizeListings");
    expect(manifest.short_name).toBe("BelizeListings");
    expect(manifest.description).toBeTruthy();
  });

  test("manifest colors match canonical PWA theme token", () => {
    expect(manifest.background_color).toBe(PWA_THEME_COLOR);
    expect(manifest.theme_color).toBe(PWA_THEME_COLOR);
    expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test("manifest declares 192x192 and 512x512 icons that exist on disk", () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));

    for (const icon of manifest.icons) {
      const iconPath = path.join(PUBLIC, icon.src.replace(/^\//, ""));
      expect(fs.existsSync(iconPath)).toBe(true);
    }
  });

  test("PWA icon PNGs match declared square dimensions", async () => {
    const checks = [
      { file: "apple-touch-icon.png", size: 180 },
      { file: "android-chrome-192x192.png", size: 192 },
      { file: "android-chrome-512x512.png", size: 512 },
      { file: "android-chrome-512x512-maskable.png", size: 512 },
    ];

    for (const { file, size } of checks) {
      const meta = await sharp(path.join(PUBLIC, file)).metadata();
      expect(meta.width).toBe(size);
      expect(meta.height).toBe(size);
    }
  });

  test("manifest uses dedicated maskable icon separate from any-purpose 512", () => {
    const any512 = manifest.icons.filter(
      (icon) => icon.sizes === "512x512" && icon.purpose === "any"
    );
    const maskable512 = manifest.icons.filter(
      (icon) => icon.sizes === "512x512" && icon.purpose === "maskable"
    );

    expect(any512).toHaveLength(1);
    expect(maskable512).toHaveLength(1);
    expect(any512[0].src).toBe("/android-chrome-512x512.png");
    expect(maskable512[0].src).toBe("/android-chrome-512x512-maskable.png");
    expect(any512[0].src).not.toBe(maskable512[0].src);

    const maskablePath = path.join(PUBLIC, "android-chrome-512x512-maskable.png");
    expect(fs.existsSync(maskablePath)).toBe(true);
  });

  test("maskable icon is a distinct asset with tighter logo inset than any icon", async () => {
    const anyPath = path.join(PUBLIC, "android-chrome-512x512.png");
    const maskablePath = path.join(PUBLIC, "android-chrome-512x512-maskable.png");

    expect(fs.readFileSync(anyPath).equals(fs.readFileSync(maskablePath))).toBe(false);

    // Opaque shell — compare logo footprint via non-background pixel bounds (#fdfcfb).
    const bg = { r: 253, g: 252, b: 251 };
    const contentBounds = async (filePath) => {
      const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let minX = info.width;
      let minY = info.height;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          const i = (y * info.width + x) * info.channels;
          const dr = Math.abs(data[i] - bg.r);
          const dg = Math.abs(data[i + 1] - bg.g);
          const db = Math.abs(data[i + 2] - bg.b);
          if (dr + dg + db > 18) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
      return { width: maxX - minX + 1, height: maxY - minY + 1 };
    };

    const [anyBounds, maskableBounds] = await Promise.all([
      contentBounds(anyPath),
      contentBounds(maskablePath),
    ]);

    expect(maskableBounds.width).toBeLessThan(anyBounds.width);
    expect(maskableBounds.height).toBeLessThan(anyBounds.height);
    // W3C maskable safe zone: circle diameter ~80% of 512 ≈ 410px.
    expect(maskableBounds.width).toBeLessThanOrEqual(410);
    expect(maskableBounds.height).toBeLessThanOrEqual(410);
  });

  test("document head includes install metadata once and links manifest once", () => {
    const document = readText(DOCUMENT_PATH);

    expect(countOccurrences(document, 'rel="manifest"')).toBe(1);
    expect(document).toContain('href="/site.webmanifest"');
    expect(document).toContain('name="mobile-web-app-capable"');
    expect(document).toContain('name="apple-mobile-web-app-capable"');
    expect(document).toContain('name="apple-mobile-web-app-status-bar-style"');
    expect(document).toContain('name="apple-mobile-web-app-title"');
    expect(document).toContain('name="theme-color"');
    expect(document).toContain("PWA_THEME_COLOR");
    expect(document).toContain('content="black-translucent"');
  });

  test("PageHead does not duplicate manifest, viewport, or theme-color tags", () => {
    const pageHead = readText(PAGE_HEAD_PATH);
    expect(pageHead).not.toContain('rel="manifest"');
    expect(pageHead).not.toContain('name="viewport"');
    expect(pageHead).not.toContain('name="theme-color"');
    expect(pageHead).not.toContain('apple-mobile-web-app-capable');
  });

  test("favicon links remain present in document head", () => {
    const document = readText(DOCUMENT_PATH);
    expect(document).toContain('href="/favicon.ico"');
    expect(document).toContain('href="/favicon-32x32.png"');
    expect(document).toContain('href="/favicon-16x16.png"');
    expect(document).toContain('href="/apple-touch-icon.png"');
  });
});
