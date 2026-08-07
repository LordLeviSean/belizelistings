/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import handler from "../../pages/api/push/vapid-public";

describe("/api/push/vapid-public", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      WEB_PUSH_VAPID_PUBLIC_KEY: "public-key",
      WEB_PUSH_VAPID_PRIVATE_KEY: "private-key",
      WEB_PUSH_VAPID_SUBJECT: "mailto:ops@belizelistings.bz",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("rejects unauthenticated requests", async () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    await handler({ method: "GET", headers: {} }, { status, json });
    expect(status).toHaveBeenCalledWith(401);
  });

  test("returns public VAPID config for authenticated users", async () => {
    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    });

    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    await handler(
      { method: "GET", headers: { authorization: "Bearer token" } },
      { status, json }
    );

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        publicKey: "public-key",
        subject: "mailto:ops@belizelistings.bz",
      })
    );
    expect(json.mock.calls[0][0]).not.toHaveProperty("privateKey");
  });
});
