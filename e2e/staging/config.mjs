/**
 * Staging E2E configuration — credentials from environment only.
 * Copy .env.test.example → .env.test.local (gitignored) for local runs.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function loadFile(path) {
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

const local = {
  ...loadFile(join(ROOT, ".env.local")),
  ...loadFile(join(ROOT, ".env.test.local")),
};

const merged = { ...local, ...process.env };

export const E2E_BASE_URL =
  merged.E2E_BASE_URL || merged.QA_BASE_URL || merged.NEXT_PUBLIC_SITE_URL || "https://belizelistings.bz";

export const ACCOUNTS = {
  buyer: {
    email: merged.E2E_BUYER_EMAIL || "",
    password: merged.E2E_BUYER_PASSWORD || "",
  },
  owner: {
    email: merged.E2E_OWNER_EMAIL || "",
    password: merged.E2E_OWNER_PASSWORD || "",
  },
  agent: {
    email: merged.E2E_AGENT_EMAIL || "",
    password: merged.E2E_AGENT_PASSWORD || "",
  },
  admin: {
    email: merged.E2E_ADMIN_EMAIL || "",
    password: merged.E2E_ADMIN_PASSWORD || "",
  },
};

/** Published listing owned by the owner/agent account — required for flows A & B. */
export const E2E_PUBLISHED_LISTING_ID = merged.E2E_PUBLISHED_LISTING_ID || "";

/** Listing the owner can mark recently closed without breaking other flows. */
export const E2E_CLOSABLE_LISTING_ID = merged.E2E_CLOSABLE_LISTING_ID || "";

export function hasAccount(role) {
  const acc = ACCOUNTS[role];
  return Boolean(acc?.email?.trim() && acc?.password?.trim());
}

export function hasFlowACredentials() {
  return hasAccount("buyer") && hasAccount("owner") && E2E_PUBLISHED_LISTING_ID;
}

export function hasFlowBCredentials() {
  return hasFlowACredentials();
}

export function hasFlowCCredentials() {
  return hasAccount("owner") && E2E_CLOSABLE_LISTING_ID;
}

export function missingCredentialMessage(flow) {
  const parts = [];
  if (!hasAccount("buyer")) parts.push("E2E_BUYER_EMAIL / E2E_BUYER_PASSWORD");
  if (!hasAccount("owner")) parts.push("E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD");
  if (flow === "A" || flow === "B") {
    if (!E2E_PUBLISHED_LISTING_ID) parts.push("E2E_PUBLISHED_LISTING_ID");
  }
  if (flow === "C" && !E2E_CLOSABLE_LISTING_ID) parts.push("E2E_CLOSABLE_LISTING_ID");
  return `Missing staging credentials: ${parts.join(", ")}`;
}
