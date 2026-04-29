export const TRACE_ACTIONS_ENABLED =
  process.env.NEXT_PUBLIC_TRACE_ACTIONS === "true";

export function traceAction(payload) {
  if (TRACE_ACTIONS_ENABLED) {
    console.log("ACTION:", payload);
  }
}

export function traceLog(...args) {
  if (TRACE_ACTIONS_ENABLED) {
    console.log(...args);
  }
}

export function traceWarn(...args) {
  if (TRACE_ACTIONS_ENABLED) {
    console.warn(...args);
  }
}
