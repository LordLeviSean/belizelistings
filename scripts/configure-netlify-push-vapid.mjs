#!/usr/bin/env node
/**
 * Configure permanent Web Push VAPID keys on Netlify production.
 * Never prints private key values.
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NETLIFY_RUNNER = join(ROOT, "node_modules", "netlify-cli", "bin", "run.js");
const SUBJECT = "mailto:ops@belizelistings.bz";

function netlify(args) {
  const result = spawnSync(process.execPath, [NETLIFY_RUNNER, ...args], {
    cwd: ROOT,
    encoding: "utf8",
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

function setEnv(key, value) {
  const { status, stderr } = netlify(["env:set", key, value, "--context", "production"]);
  return { ok: status === 0, error: stderr };
}

async function main() {
  const { keys: current, error: listError } = listProductionKeys();

  const report = {
    site: "belizelistings (https://belizelistings.bz)",
    listed: !listError,
    listError: listError || null,
    generated: false,
    set: [],
    skipped: [],
    failed: [],
    verification: {},
  };

  let publicKey = current.WEB_PUSH_VAPID_PUBLIC_KEY;
  let privateKey = current.WEB_PUSH_VAPID_PRIVATE_KEY;
  let subject = current.WEB_PUSH_VAPID_SUBJECT || SUBJECT;

  if (!publicKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    report.generated = true;
  } else if (!privateKey) {
    report.failed.push({
      key: "WEB_PUSH_VAPID_PRIVATE_KEY",
      error: "Public key exists but private key is missing — set manually in Netlify.",
    });
  }

  if (!publicKey || !privateKey) {
    const { keys: afterPartial } = listProductionKeys();
    for (const key of ["WEB_PUSH_VAPID_PUBLIC_KEY", "WEB_PUSH_VAPID_PRIVATE_KEY", "WEB_PUSH_VAPID_SUBJECT"]) {
      report.verification[key] = afterPartial[key] ? "SET" : "MISSING";
    }
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const toSet = {
    WEB_PUSH_VAPID_PUBLIC_KEY: publicKey,
    WEB_PUSH_VAPID_PRIVATE_KEY: privateKey,
    WEB_PUSH_VAPID_SUBJECT: subject,
  };

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
  for (const key of Object.keys(toSet)) {
    report.verification[key] = after[key] ? "SET" : "MISSING";
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
