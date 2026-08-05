/**
 * Generate BelizeListings favicon set from the official wordmark.
 * Focus crop: capital "B" + wave (left mark) for legibility at 16×16.
 *
 * Run: node scripts/generate-favicons.mjs
 * Requires: sharp, to-ico (devDependencies)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import toIco from "to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "public/brand/belizelistings-logo-source.png");
const OUT = path.join(ROOT, "public");

/** Matches homepage shell token (`globals.css` / `.page` gradient terminus). */
export const PWA_ICON_BACKGROUND = { r: 253, g: 252, b: 251, alpha: 1 };

/** Left mark crop — "B" + wave reads best at favicon sizes. */
const MARK_CROP = { left: 0, top: 0, width: 300, height: 341 };

async function buildMarkBuffer() {
  const meta = await sharp(SOURCE).metadata();
  const crop = {
    left: MARK_CROP.left,
    top: MARK_CROP.top,
    width: Math.min(MARK_CROP.width, meta.width),
    height: Math.min(MARK_CROP.height, meta.height),
  };
  const side = Math.max(crop.width, crop.height);
  const padLeft = Math.floor((side - crop.width) / 2);
  const padTop = Math.floor((side - crop.height) / 2);
  const padRight = side - crop.width - padLeft;
  const padBottom = side - crop.height - padTop;

  return sharp(SOURCE)
    .extract(crop)
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: PWA_ICON_BACKGROUND,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writeSquarePng(markBuffer, size, filename, { sharpen = false, insetRatio = 0.14 } = {}) {
  const logoMax = Math.max(1, Math.round(size * (1 - insetRatio * 2)));
  let mark = sharp(markBuffer).resize(logoMax, logoMax, {
    fit: "inside",
    background: PWA_ICON_BACKGROUND,
  });
  if (sharpen && size <= 32) {
    mark = mark.sharpen({ sigma: 0.6 });
  }

  const logoBuffer = await mark.png({ compressionLevel: 9 }).toBuffer();
  const markMeta = await sharp(logoBuffer).metadata();
  if ((markMeta.width || 0) > size || (markMeta.height || 0) > size) {
    throw new Error(
      `${filename} mark exceeds canvas (${markMeta.width}x${markMeta.height} > ${size}x${size})`
    );
  }

  const outPath = path.join(OUT, filename);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: PWA_ICON_BACKGROUND,
    },
  })
    .composite([{ input: logoBuffer, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  const { width, height } = await sharp(outPath).metadata();
  if (width !== size || height !== size) {
    throw new Error(`${filename} expected ${size}x${size}, got ${width}x${height}`);
  }
}

async function main() {
  await fs.access(SOURCE);
  const markBuffer = await buildMarkBuffer();
  const squareMeta = await sharp(markBuffer).metadata();
  if (squareMeta.width !== squareMeta.height) {
    throw new Error(`Mark source must be square, got ${squareMeta.width}x${squareMeta.height}`);
  }

  const sizes = [
    { size: 16, file: "favicon-16x16.png", sharpen: true, insetRatio: 0.1 },
    { size: 32, file: "favicon-32x32.png", sharpen: true, insetRatio: 0.1 },
    { size: 180, file: "apple-touch-icon.png", insetRatio: 0.14 },
    { size: 192, file: "android-chrome-192x192.png", insetRatio: 0.14 },
    { size: 512, file: "android-chrome-512x512.png", insetRatio: 0.18 },
    { size: 150, file: "mstile-150x150.png", insetRatio: 0.14 },
  ];

  for (const { size, file, sharpen, insetRatio } of sizes) {
    await writeSquarePng(markBuffer, size, file, { sharpen, insetRatio });
    console.log(`wrote ${file} (${size}x${size})`);
  }

  const png16 = await sharp(path.join(OUT, "favicon-16x16.png")).toBuffer();
  const png32 = await sharp(path.join(OUT, "favicon-32x32.png")).toBuffer();
  const ico = await toIco([png16, png32]);
  await fs.writeFile(path.join(OUT, "favicon.ico"), ico);
  console.log("wrote favicon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
