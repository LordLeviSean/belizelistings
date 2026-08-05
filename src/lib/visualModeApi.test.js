/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import publicHandler from "../pages/api/visual-mode/index";
import adminHandler from "../pages/api/admin/visual-mode";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
}

describe("visual mode API routes", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...origEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };
  });

  afterAll(() => {
    process.env = origEnv;
  });

  test("GET /api/visual-mode returns only the four public settings", async () => {
    createClient.mockReturnValue({
      rpc: jest.fn().mockResolvedValue({
        data: {
          livePalette: true,
          pulse: false,
          seaFlow: true,
          seaFlowIntensity: 1,
        },
        error: null,
      }),
    });

    const res = mockRes();
    await publicHandler({ method: "GET" }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      livePalette: true,
      pulse: false,
      seaFlow: true,
      seaFlowIntensity: 1,
      source: "server",
    });
  });

  test("GET /api/visual-mode falls back to defaults when RPC fails", async () => {
    createClient.mockReturnValue({
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "fail" } }),
    });

    const res = mockRes();
    await publicHandler({ method: "GET" }, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        livePalette: false,
        pulse: false,
        seaFlow: false,
        seaFlowIntensity: 0.5,
        source: "defaults",
      })
    );
  });

  test("PATCH /api/admin/visual-mode rejects anonymous requests", async () => {
    createClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
      rpc: jest.fn(),
    });

    const res = mockRes();
    await adminHandler(
      {
        method: "PATCH",
        headers: {},
        body: {
          livePalette: true,
          pulse: false,
          seaFlow: false,
          seaFlowIntensity: 0.5,
        },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("PATCH /api/admin/visual-mode rejects non-admin authenticated users", async () => {
    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "admin_required", code: "42501" },
      }),
    });

    const res = mockRes();
    await adminHandler(
      {
        method: "PATCH",
        headers: { authorization: "Bearer user-token" },
        body: {
          livePalette: true,
          pulse: false,
          seaFlow: false,
          seaFlowIntensity: 0.5,
        },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("PATCH /api/admin/visual-mode succeeds for admin RPC update", async () => {
    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
      },
      rpc: jest.fn().mockResolvedValue({
        data: {
          livePalette: true,
          pulse: true,
          seaFlow: false,
          seaFlowIntensity: 0.75,
        },
        error: null,
      }),
    });

    const res = mockRes();
    await adminHandler(
      {
        method: "PATCH",
        headers: { authorization: "Bearer admin-token" },
        body: {
          livePalette: true,
          pulse: true,
          seaFlow: false,
          seaFlowIntensity: 0.75,
        },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        livePalette: true,
        pulse: true,
        seaFlowIntensity: 0.75,
        source: "server",
      })
    );
  });

  test("PATCH /api/admin/visual-mode rejects invalid intensity", async () => {
    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
      },
      rpc: jest.fn(),
    });

    const res = mockRes();
    await adminHandler(
      {
        method: "PATCH",
        headers: { authorization: "Bearer admin-token" },
        body: {
          livePalette: false,
          pulse: false,
          seaFlow: false,
          seaFlowIntensity: 99,
        },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "invalid_intensity" })
    );
  });
});
