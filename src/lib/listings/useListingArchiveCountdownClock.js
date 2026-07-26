import { useEffect, useSyncExternalStore } from "react";

let snapshotNow = Date.now();
/** @type {Set<() => void>} */
const listeners = new Set();
/** @type {Set<number>} */
const deadlines = new Set();
/** @type {ReturnType<typeof setInterval>|null} */
let timerId = null;

function getIntervalMs() {
  const now = Date.now();
  for (const deadline of deadlines) {
    if (deadline - now <= 60_000) return 1000;
  }
  return 60_000;
}

function tick() {
  snapshotNow = Date.now();
  listeners.forEach((listener) => listener());
}

function ensureTimer() {
  const intervalMs = getIntervalMs();
  if (timerId) clearInterval(timerId);
  if (deadlines.size === 0) {
    timerId = null;
    return;
  }
  timerId = setInterval(() => {
    tick();
    const nextIntervalMs = getIntervalMs();
    if (nextIntervalMs !== intervalMs) ensureTimer();
  }, intervalMs);
  tick();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshotNow;
}

/**
 * Shared countdown clock for management listing cards.
 * Ticks every minute by default, every second when any card is under one minute.
 * @param {number|null|undefined} deadlineMs
 */
export function useListingArchiveCountdownClock(deadlineMs) {
  useEffect(() => {
    if (deadlineMs == null || !Number.isFinite(deadlineMs)) return undefined;
    deadlines.add(deadlineMs);
    ensureTimer();
    return () => {
      deadlines.delete(deadlineMs);
      if (deadlines.size === 0 && timerId) {
        clearInterval(timerId);
        timerId = null;
      } else {
        ensureTimer();
      }
    };
  }, [deadlineMs]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test-only reset for timer registry. */
export function __resetListingArchiveCountdownClockForTests() {
  if (timerId) clearInterval(timerId);
  timerId = null;
  deadlines.clear();
  listeners.clear();
  snapshotNow = Date.now();
}
