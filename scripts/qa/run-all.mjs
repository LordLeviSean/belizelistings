#!/usr/bin/env node
/** Full QA suite — mobile, desktop, screenshots, lighthouse (optional). */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const steps = [
  ["mobile", "run-mobile.mjs"],
  ["desktop", "run-desktop.mjs"],
  ["screenshots", "run-screenshots.mjs"],
  ["lighthouse", "run-lighthouse.mjs"],
];

const results = [];
let failed = false;

for (const [name, script] of steps) {
  const r = spawnSync(process.execPath, [join(dir, script)], {
    stdio: "inherit",
    env: process.env,
  });
  const ok = (r.status ?? 1) === 0;
  results.push({ step: name, pass: ok });
  if (!ok && name !== "lighthouse") failed = true;
}

console.log("\n--- QA SUMMARY ---");
console.log(JSON.stringify({ pass: !failed, results }, null, 2));
process.exitCode = failed ? 1 : 0;
