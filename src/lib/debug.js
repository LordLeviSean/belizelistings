import { traceLog } from "./trace";

export const createDebugger = (label) => {
  const state = {};

  const log = (key, value) => {
    state[key] = value;
    traceLog(`[${label}]`, key, value);
  };

  const getState = () => state;

  return { log, getState };
};
