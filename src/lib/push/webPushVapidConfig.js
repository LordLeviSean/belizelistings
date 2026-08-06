/**
 * Server-only Web Push VAPID configuration.
 * Private key must never be exposed to client bundles.
 */

const PUBLIC_KEY_ENV = "WEB_PUSH_VAPID_PUBLIC_KEY";
const PRIVATE_KEY_ENV = "WEB_PUSH_VAPID_PRIVATE_KEY";
const SUBJECT_ENV = "WEB_PUSH_VAPID_SUBJECT";

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function readWebPushVapidConfig(env = process.env) {
  const publicKey = String(env?.[PUBLIC_KEY_ENV] ?? "").trim();
  const privateKey = String(env?.[PRIVATE_KEY_ENV] ?? "").trim();
  const subject = String(env?.[SUBJECT_ENV] ?? "").trim();

  const configured = Boolean(publicKey && privateKey && subject);
  const clientSafe = configured
    ? {
        publicKey,
        subject,
      }
    : null;

  return {
    configured,
    publicKey: configured ? publicKey : null,
    privateKey: configured ? privateKey : null,
    subject: configured ? subject : null,
    clientSafe,
    missing: [
      !publicKey ? PUBLIC_KEY_ENV : null,
      !privateKey ? PRIVATE_KEY_ENV : null,
      !subject ? SUBJECT_ENV : null,
    ].filter(Boolean),
  };
}

/**
 * Safe check for server delivery — never throws.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isWebPushConfigured(env = process.env) {
  return readWebPushVapidConfig(env).configured;
}

/**
 * Returns public VAPID material suitable for authenticated subscription APIs later.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function getClientSafeVapidPublicConfig(env = process.env) {
  return readWebPushVapidConfig(env).clientSafe;
}

export const WEB_PUSH_VAPID_ENV_NAMES = Object.freeze({
  PUBLIC_KEY: PUBLIC_KEY_ENV,
  PRIVATE_KEY: PRIVATE_KEY_ENV,
  SUBJECT: SUBJECT_ENV,
});
