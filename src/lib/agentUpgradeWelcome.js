import { AGENT_WELCOME_STORAGE_KEY } from "@/constants/dashboardAgentConfig";

/** @type {Set<(userId: string) => void>} */
const listeners = new Set();

const PENDING_KEY = "bl_agent_welcome_pending_v1";

function readMap(key) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(key, map) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} userId
 * @returns {boolean}
 */
export function shouldShowAgentWelcomeModal(userId) {
  if (typeof window === "undefined" || !userId) return false;
  const pending = readMap(PENDING_KEY);
  if (pending[String(userId)] === true) return true;
  return false;
}

/**
 * Mark upgrade approved — show welcome on next agent session until dismissed.
 * @param {string} userId
 */
export function markAgentWelcomePending(userId) {
  if (!userId) return;
  const pending = readMap(PENDING_KEY);
  pending[String(userId)] = true;
  writeMap(PENDING_KEY, pending);
}

/**
 * @param {string} userId
 */
export function markAgentWelcomeSeen(userId) {
  if (typeof window === "undefined" || !userId) return;
  const seen = readMap(AGENT_WELCOME_STORAGE_KEY);
  seen[String(userId)] = true;
  writeMap(AGENT_WELCOME_STORAGE_KEY, seen);
  const pending = readMap(PENDING_KEY);
  delete pending[String(userId)];
  writeMap(PENDING_KEY, pending);
}

/**
 * @param {string} userId
 */
export function emitAgentUpgradeApproved(userId) {
  if (!userId) return;
  markAgentWelcomePending(userId);
  for (const cb of listeners) {
    try {
      cb(String(userId));
    } catch {
      /* ignore listener errors */
    }
  }
}

/**
 * @param {(userId: string) => void} cb
 * @returns {() => void}
 */
export function onAgentUpgradeApproved(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
