import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chunksDir = resolve(root, ".next/static/chunks");

function scanChunks(label) {
  const files = readdirSync(chunksDir).filter((f) => f.endsWith(".js"));
  let hits = [];
  for (const f of files) {
    const js = readFileSync(resolve(chunksDir, f), "utf8");
    if (!js.includes("BL_ENABLE_LISTING_EVENTS")) continue;
    const idx = js.indexOf("BL_ENABLE_LISTING_EVENTS");
    hits.push({ file: f, context: js.substring(Math.max(0, idx - 100), idx + 150) });
  }
  console.log(`\n=== ${label} (${hits.length} chunks with BL_ENABLE_LISTING_EVENTS) ===`);
  for (const h of hits) {
    console.log(`\n${h.file}:`);
    console.log(h.context);
  }
  const allJs = hits.map((h) => h.context).join("\n");
  console.log("\nStatic inlines:");
  console.log("  NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS:true ->", allJs.includes('NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS:"true"'));
  console.log("  export g=!0 (true) ->", /BL_ENABLE_LISTING_EVENTS",0,!0/.test(allJs) || /BL_ENABLE_LISTING_EVENTS",0,g\],16989/.test(allJs));
  console.log("  dynamic c() call ->", allJs.includes('c("NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS")'));
}

scanChunks("local build");
