#!/usr/bin/env node
/**
 * Verify deployed cron endpoint — never prints CRON_SECRET.
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

async function main() {
  const env = { ...loadEnvLocal(), ...process.env };
  const secret = env.CRON_SECRET;
  const baseUrl = env.E2E_BASE_URL || env.QA_BASE_URL || "https://belizelistings.bz";

  if (!secret) {
    console.log(JSON.stringify({ ok: false, error: "CRON_SECRET not set locally" }, null, 2));
    process.exit(1);
  }

  const url = `${baseUrl.replace(/\/$/, "")}/api/cron/process-notifications?limit=10`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.json().catch(() => ({}));

  console.log(
    JSON.stringify(
      {
        ok: res.ok && body.ok === true,
        status: res.status,
        baseUrl,
        result: body,
      },
      null,
      2
    )
  );
  process.exit(res.ok && body.ok === true ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
