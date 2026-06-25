#!/usr/bin/env node
/**
 * Apply pending Supabase migrations to remote Postgres.
 *
 * Usage:
 *   node scripts/apply-supabase-migrations.mjs [migration-file...]
 *
 * Credentials (first match wins):
 *   1. DATABASE_URL or DIRECT_URL — direct Postgres (recommended for CI)
 *   2. SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL — Management API
 *   3. npx supabase db push --linked (requires prior `supabase link`)
 *
 * Reads .env.local for NEXT_PUBLIC_SUPABASE_URL when project ref is needed.
 */

import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const DEFAULT_MIGRATIONS = [
  "20260625120000_listing_verification_status.sql",
  "20260625130000_listing_verification_metadata.sql",
];

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
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
  } catch {
    return {};
  }
}

function mergeEnv() {
  const local = loadEnvLocal();
  return { ...local, ...process.env };
}

function projectRefFromUrl(url) {
  if (!url) return null;
  const match = String(url).match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] || null;
}

async function applyViaPg(dbUrl, sql, label) {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    throw new Error(
      "pg package not installed. Run: npm install --save-dev pg — or set DATABASE_URL and use psql."
    );
  }
  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`✓ ${label} — applied via DATABASE_URL`);
  } finally {
    await client.end();
  }
}

async function applyViaManagementApi({ accessToken, projectRef, sql, label }) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Management API ${res.status} for ${label}: ${body}`);
  }
  console.log(`✓ ${label} — applied via Supabase Management API`);
}

function applyViaSupabaseCli() {
  const result = spawnSync("npx", ["supabase", "db", "push", "--linked", "--yes"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error("supabase db push --linked failed (project not linked or missing access token)");
  }
  console.log("✓ migrations — applied via supabase db push --linked");
}

async function main() {
  const env = mergeEnv();
  const args = process.argv.slice(2);
  const files =
    args.length > 0
      ? args.map((f) => (f.endsWith(".sql") ? f : `${f}.sql`))
      : DEFAULT_MIGRATIONS;

  for (const file of files) {
    const path = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(path, "utf8");
    const label = file;

    const dbUrl = env.DATABASE_URL || env.DIRECT_URL;
    const accessToken = env.SUPABASE_ACCESS_TOKEN;
    const projectRef = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);

    if (dbUrl) {
      await applyViaPg(dbUrl, sql, label);
      continue;
    }

    if (accessToken && projectRef) {
      await applyViaManagementApi({ accessToken, projectRef, sql, label });
      continue;
    }

    console.error(`
Cannot apply ${label}. Missing credentials.

Add ONE of the following to .env.local or your shell environment:

  DATABASE_URL=postgresql://postgres.[ref]:[password]@...supabase.com:6543/postgres
  — or —
  SUPABASE_ACCESS_TOKEN=sbp_...   (from https://supabase.com/dashboard/account/tokens)
  NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co

Alternatively:
  npx supabase login
  npx supabase link --project-ref ${projectRef || "[ref]"}
  npx supabase db push --linked

Or paste migration SQL into Supabase Dashboard → SQL Editor.
`);
    process.exit(1);
  }

  console.log("\nAll requested migrations applied successfully.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
