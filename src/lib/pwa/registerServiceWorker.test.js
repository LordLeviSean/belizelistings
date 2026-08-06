/** @jest-environment jsdom */

import {
  registerBelizeListingsServiceWorker,
  SERVICE_WORKER_SCOPE,
  SERVICE_WORKER_URL,
} from "./registerServiceWorker";

describe("registerBelizeListingsServiceWorker", () => {
  test("registers /sw.js at scope / on https", async () => {
    const register = jest.fn().mockResolvedValue({});
    const result = registerBelizeListingsServiceWorker({
      navigator: { serviceWorker: { register } },
      location: { protocol: "https:", hostname: "belizelistings.bz" },
    });

    expect(result.registered).toBe(true);
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_URL, { scope: SERVICE_WORKER_SCOPE });

    const settled = await result.registrationPromise;
    expect(settled.registered).toBe(true);
  });

  test("registers on localhost http for development", () => {
    const register = jest.fn().mockResolvedValue({});
    registerBelizeListingsServiceWorker({
      navigator: { serviceWorker: { register } },
      location: { protocol: "http:", hostname: "localhost" },
    });
    expect(register).toHaveBeenCalled();
  });

  test("skips registration on insecure non-localhost origins", () => {
    const register = jest.fn();
    const result = registerBelizeListingsServiceWorker({
      navigator: { serviceWorker: { register } },
      location: { protocol: "http:", hostname: "example.test" },
    });
    expect(result.registered).toBe(false);
    expect(result.reason).toBe("insecure-origin");
    expect(register).not.toHaveBeenCalled();
  });

  test("skips when service workers are unavailable", () => {
    const result = registerBelizeListingsServiceWorker({
      navigator: {},
      location: { protocol: "https:", hostname: "belizelistings.bz" },
    });
    expect(result.registered).toBe(false);
    expect(result.reason).toBe("unsupported");
  });

  test("registration rejection does not throw", async () => {
    const register = jest.fn().mockRejectedValue(new Error("blocked"));
    const result = registerBelizeListingsServiceWorker({
      navigator: { serviceWorker: { register } },
      location: { protocol: "https:", hostname: "belizelistings.bz" },
    });

    await expect(result.registrationPromise).resolves.toEqual({
      registered: false,
      reason: "registration-failed",
    });
  });
});
