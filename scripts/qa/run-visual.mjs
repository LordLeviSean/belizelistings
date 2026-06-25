#!/usr/bin/env node
/** Visual QA — delegates to screenshot capture (regression baseline). */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const child = spawnSync(process.execPath, [join(dir, "run-screenshots.mjs")], {
  stdio: "inherit",
  env: process.env,
});
process.exit(child.status ?? 1);
