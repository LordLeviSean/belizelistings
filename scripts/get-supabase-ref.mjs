import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const match = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
if (!match) {
  console.error("missing url");
  process.exit(1);
}
let url = match[1].trim().replace(/^["']|["']$/g, "");
const ref = new URL(url).hostname.split(".")[0];
console.log(ref);
