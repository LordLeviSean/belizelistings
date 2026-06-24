import { isTerminalDashboardCountError } from "./supabaseCompat";
import { logRawSupabaseError } from "./supabaseRawError";

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/** One console diagnostic per (scope × error signature) per full page session (SPA). */
const loggedDashboardMetricFailures = new Set();

function failureSignature(scope, error) {
  const code = String(error?.code ?? error?.status ?? error?.statusCode ?? "nocode");
  const msg = String(error?.message ?? "").slice(0, 200);
  const details = String(error?.details ?? "").slice(0, 200);
  return `${scope}|${code}|${msg}|${details}`;
}

/**
 * @param {"favorites count"|"inquiries count"|"listings active count"} scope
 * @param {object} [requestShape] PostgREST-ish request description for dev diagnosis
 */
export function logDashboardMetricFailureOnce(scope, error, requestShape) {
  if (!error) return;
  if (!isDev) return;
  const sig = failureSignature(scope, error);
  const key = `${scope}::${sig}`;
  if (loggedDashboardMetricFailures.has(key)) return;
  loggedDashboardMetricFailures.add(key);
  logRawSupabaseError(`[user-dashboard] ${scope}`, error, {
    terminal: isTerminalDashboardCountError(error),
    requestShape,
    /** Avoid Next dev overlay (nextJsHandleConsoleError) on expected / handled probe failures. */
    logLevel: "warn",
  });
}
