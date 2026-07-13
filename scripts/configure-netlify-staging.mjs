#!/usr/bin/env node
/**
 * Configure Netlify production env for open beta — never prints secret values.
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_LOCAL = join(ROOT, ".env.local");

const BUILD_FLAGS = {
  NEXT_PUBLIC_BL_ENABLE_INQUIRIES: "1",
  NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS: "1",
  NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST: "1",
  NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS: "1",
  NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS: "1",
};

function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL)) return {};
  const env = {};
  for (const line of readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    value = value.replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

function netlify(args) {
  const result = spawnSync("npx", ["netlify", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function listProductionKeys() {
  const { stdout, stderr, status } = netlify(["env:list", "--context", "production", "--json"]);
  const raw = stdout.trim();
  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) {
    return { error: stderr || raw || `exit ${status}`, keys: {} };
  }
  try {
    return { keys: JSON.parse(raw.slice(jsonStart)) };
  } catch (e) {
    return { error: e.message, keys: {} };
  }
}

function setEnv(key, value, context = "production") {
  const { status, stderr } = netlify(["env:set", key, value, "--context", context]);
  return { ok: status === 0, error: stderr };
}

function ensureCronSecret(local) {
  if (local.CRON_SECRET?.trim()) return local.CRON_SECRET.trim();
  const generated = randomBytes(32).toString("hex");
  const line = `\nCRON_SECRET=${generated}\n`;
  appendFileSync(ENV_LOCAL, line, "utf8");
  return generated;
}

async function main() {
  const local = loadEnvLocal();
  const { keys: current, error: listError } = listProductionKeys();

  const report = {
    site: "belizelistings (https://belizelistings.bz)",
    siteId: "94710793-73da-4300-98ed-013164bde3ad",
    listed: !listError,
    listError: listError || null,
    set: [],
    skipped: [],
    failed: [],
  };

  const toSet = { ...BUILD_FLAGS };

  if (local.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    toSet.SUPABASE_SERVICE_ROLE_KEY = local.SUPABASE_SERVICE_ROLE_KEY.trim();
  }

  const cronSecret = ensureCronSecret(local);
  toSet.CRON_SECRET = cronSecret;

  for (const [key, value] of Object.entries(toSet)) {
    if (current[key] === value) {
      report.skipped.push(key);
      continue;
    }
    const result = setEnv(key, value);
    if (result.ok) {
      report.set.push(key);
    } else {
      report.failed.push({ key, error: result.error?.slice(0, 200) });
    }
  }

  const { keys: after } = listProductionKeys();
  report.verification = {};
  for (const key of Object.keys({ ...BUILD_FLAGS, CRON_SECRET: 1, SUPABASE_SERVICE_ROLE_KEY: 1 })) {
    report.verification[key] = after[key] ? "SET" : "MISSING";
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
