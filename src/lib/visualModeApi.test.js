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

  test("GET /api/visual-mode returns normalized public settings without sea flow", async () => {
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
        },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("PATCH /api/admin/visual-mode succeeds and forces dormant sea flow RPC values", async () => {
    const getUser = jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const rpc = jest.fn().mockResolvedValue({
      data: {
        livePalette: true,
        pulse: true,
        seaFlow: false,
        seaFlowIntensity: 0.5,
      },
      error: null,
    });
    createClient.mockReturnValue({
      auth: { getUser },
      rpc,
    });

    const res = mockRes();
    await adminHandler(
      {
        method: "PATCH",
        headers: { authorization: "Bearer admin-token" },
        body: {
          livePalette: true,
          pulse: true,
        },
      },
      res
    );

    expect(getUser).toHaveBeenCalledWith("admin-token");
    expect(rpc).toHaveBeenCalledWith("update_visual_mode_platform_config", {
      p_live_palette_mode: true,
      p_pulse_mode: true,
      p_sea_flow_mode: false,
      p_sea_flow_intensity: 0.5,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        livePalette: true,
        pulse: true,
        source: "server",
      })
    );
  });

  test("PATCH /api/admin/visual-mode maps broken intensity storage RPC failure", async () => {
    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
      },
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'invalid input syntax for type numeric: "0.5#"',
          code: "22P02",
        },
      }),
    });

    const res = mockRes();
    await adminHandler(
      {
        method: "PATCH",
        headers: { authorization: "Bearer admin-token" },
        body: {
          livePalette: true,
          pulse: false,
        },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "invalid_intensity_storage" })
    );
  });

  test("PATCH /api/admin/visual-mode rejects missing fields", async () => {
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
        },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "invalid_payload" })
    );
  });
});
