export const createDebugger = (label) => {
  const state = {};

  const log = (key, value) => {
    state[key] = value;
    console.log(`[${label}]`, key, value);
  };

  const getState = () => state;

  return { log, getState };
};
