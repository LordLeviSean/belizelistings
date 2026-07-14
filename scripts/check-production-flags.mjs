#!/usr/bin/env node
/** Report Netlify production flag enabled/disabled — never prints secret values. */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_ID = "94710793-73da-4300-98ed-013164bde3ad";

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

function loadNetlifyToken() {
  const path = join(homedir(), "AppData", "Roaming", "netlify", "Config", "config.json");
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const users = raw.users || {};
  const first = Object.values(users)[0];
  return first?.auth?.token || raw?.auth?.token || null;
}

function productionValue(envVar) {
  const values = envVar?.values || [];
  const prod = values.find((v) => v.context === "production");
  if (prod?.value != null) return prod.value;
  const all = values.find((v) => v.context === "all");
  return all?.value ?? null;
}

const FLAGS = [
  "NEXT_PUBLIC_BL_ENABLE_INQUIRIES",
  "NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS",
  "NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST",
  "NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS",
];

const local = loadEnvLocal();
const token = loadNetlifyToken();

const report = {
  site: "belizelistings.bz",
  api: token ? "ok" : "no_token",
  flags: {},
  secrets: {
    CRON_SECRET: {
      netlify: "unknown",
      local: local.CRON_SECRET ? "SET" : "MISSING",
    },
  },
};

if (!token) {
  console.log(JSON.stringify({ ...report, error: "Netlify auth token not found" }, null, 2));
  process.exit(1);
}

const res = await fetch(
  `https://api.netlify.com/api/v1/sites/${SITE_ID}/env?context_name=production`,
  { headers: { Authorization: `Bearer ${token}` } }
);

if (!res.ok) {
  console.log(JSON.stringify({ ...report, error: `Netlify API ${res.status}` }, null, 2));
  process.exit(1);
}

const envVars = await res.json();
const byKey = Object.fromEntries((envVars || []).map((row) => [row.key, row]));

report.secrets.CRON_SECRET.netlify = byKey.CRON_SECRET ? "SET" : "MISSING";

for (const key of FLAGS) {
  const value = productionValue(byKey[key]);
  report.flags[key] = value === "1" ? "enabled" : value ? "set_non_default" : "disabled_or_missing";
}

console.log(JSON.stringify(report, null, 2));
