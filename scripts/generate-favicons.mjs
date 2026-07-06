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

/** Left mark crop — "B" + wave reads best at favicon sizes. */
const MARK_CROP = { left: 0, top: 0, width: 300, height: 341 };

async function buildMarkPipeline() {
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
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .resize(side, side, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } });
}

async function writePng(pipeline, size, filename, { sharpen = false } = {}) {
  let img = pipeline.clone().resize(size, size, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  });
  if (sharpen && size <= 32) {
    img = img.sharpen({ sigma: 0.6 });
  }
  await img.png({ compressionLevel: 9 }).toFile(path.join(OUT, filename));
}

async function main() {
  await fs.access(SOURCE);
  const mark = await buildMarkPipeline();

  const sizes = [
    { size: 16, file: "favicon-16x16.png", sharpen: true },
    { size: 32, file: "favicon-32x32.png", sharpen: true },
    { size: 180, file: "apple-touch-icon.png" },
    { size: 192, file: "android-chrome-192x192.png" },
    { size: 512, file: "android-chrome-512x512.png" },
    { size: 150, file: "mstile-150x150.png" },
  ];

  for (const { size, file, sharpen } of sizes) {
    await writePng(mark, size, file, { sharpen });
    console.log(`wrote ${file}`);
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
