#!/usr/bin/env node
/**
 * Report whether staging credentials exist — never prints secret values.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "NETLIFY_AUTH_TOKEN",
  "NETLIFY_SITE_ID",
  "CRON_SECRET",
  "QA_BASE_URL",
  "QA_EMAIL",
  "QA_PASSWORD",
  "E2E_BUYER_EMAIL",
  "E2E_BUYER_PASSWORD",
  "E2E_OWNER_EMAIL",
  "E2E_OWNER_PASSWORD",
  "E2E_AGENT_EMAIL",
  "E2E_AGENT_PASSWORD",
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
];

const local = loadEnvLocal();
const merged = { ...local, ...process.env };

for (const key of KEYS) {
  const value = merged[key];
  const set = Boolean(value && String(value).trim());
  console.log(`${key}: ${set ? "SET" : "NOT SET"}`);
}
