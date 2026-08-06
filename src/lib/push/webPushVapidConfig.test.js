/** @jest-environment node */

import {
  getClientSafeVapidPublicConfig,
  isWebPushConfigured,
  readWebPushVapidConfig,
  WEB_PUSH_VAPID_ENV_NAMES,
} from "./webPushVapidConfig";

describe("webPushVapidConfig", () => {
  test("missing configuration fails safely", () => {
    const config = readWebPushVapidConfig({});
    expect(config.configured).toBe(false);
    expect(config.publicKey).toBeNull();
    expect(config.privateKey).toBeNull();
    expect(config.clientSafe).toBeNull();
    expect(isWebPushConfigured({})).toBe(false);
  });

  test("client-safe config excludes private key", () => {
    const env = {
      [WEB_PUSH_VAPID_ENV_NAMES.PUBLIC_KEY]: "test-public-key",
      [WEB_PUSH_VAPID_ENV_NAMES.PRIVATE_KEY]: "test-private-key",
      [WEB_PUSH_VAPID_ENV_NAMES.SUBJECT]: "mailto:ops@belizelistings.bz",
    };
    const config = readWebPushVapidConfig(env);
    expect(config.configured).toBe(true);
    expect(getClientSafeVapidPublicConfig(env)).toEqual({
      publicKey: "test-public-key",
      subject: "mailto:ops@belizelistings.bz",
    });
    expect(getClientSafeVapidPublicConfig(env)).not.toHaveProperty("privateKey");
    expect(JSON.stringify(getClientSafeVapidPublicConfig(env))).not.toContain("test-private-key");
  });

  test("does not log or expose private key in configured object to client paths", () => {
    const env = {
      [WEB_PUSH_VAPID_ENV_NAMES.PUBLIC_KEY]: "public",
      [WEB_PUSH_VAPID_ENV_NAMES.PRIVATE_KEY]: "secret-private",
      [WEB_PUSH_VAPID_ENV_NAMES.SUBJECT]: "mailto:ops@belizelistings.bz",
    };
    const safe = getClientSafeVapidPublicConfig(env);
    expect(safe).not.toEqual(expect.objectContaining({ privateKey: "secret-private" }));
  });
});
