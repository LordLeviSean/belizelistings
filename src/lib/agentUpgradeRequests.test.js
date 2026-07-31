/** @jest-environment node */

jest.mock("./supabaseClient", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

import { supabase } from "./supabaseClient";
import {
  canSubmitAgentUpgradeRequest,
  fetchAgentUpgradeRequestHistoryForUser,
  fetchLatestResolvedAgentUpgradeRequestForUser,
  fetchPendingAgentUpgradeRequestForUser,
  fetchPendingAgentUpgradeRequests,
  getAgentUpgradeCycleId,
  resolveAgentUpgradeRequest,
  submitAgentUpgradeRequest,
} from "./agentUpgradeRequests";
import { AGENT_UPGRADE_REQUEST_STATUS } from "@/constants/agentUpgradeNotifications";

function chain(result) {
  const api = {
    select: jest.fn(() => api),
    eq: jest.fn(() => api),
    in: jest.fn(() => api),
    order: jest.fn(() => api),
    limit: jest.fn(() => api),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    insert: jest.fn(() => api),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return api;
}

describe("agentUpgradeRequests cycle model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("fetchPendingAgentUpgradeRequestForUser returns current pending cycle", async () => {
    const pending = {
      id: "req-pending",
      user_id: "user-1",
      status: AGENT_UPGRADE_REQUEST_STATUS.PENDING,
    };
    supabase.from.mockReturnValue(
      chain({ data: pending, error: null })
    );

    const { data, error } = await fetchPendingAgentUpgradeRequestForUser("user-1");
    expect(error).toBeNull();
    expect(data?.id).toBe("req-pending");
    expect(getAgentUpgradeCycleId(data)).toBe("req-pending");
  });

  test("fetchPendingAgentUpgradeRequests lists admin pending queue", async () => {
    const rows = [
      { id: "a", status: AGENT_UPGRADE_REQUEST_STATUS.PENDING },
      { id: "b", status: AGENT_UPGRADE_REQUEST_STATUS.PENDING },
    ];
    supabase.from.mockReturnValue(chain({ data: rows, error: null }));

    const { data } = await fetchPendingAgentUpgradeRequests();
    expect(data).toHaveLength(2);
    expect(data.map((r) => r.id)).toEqual(["a", "b"]);
  });

  test("fetchLatestResolvedAgentUpgradeRequestForUser returns most recent resolved cycle", async () => {
    const resolved = {
      id: "req-rejected",
      status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED,
      reviewed_at: "2026-07-10T00:00:00.000Z",
    };
    supabase.from.mockReturnValue(chain({ data: resolved, error: null }));

    const { data } = await fetchLatestResolvedAgentUpgradeRequestForUser("user-1");
    expect(data?.id).toBe("req-rejected");
  });

  test("fetchAgentUpgradeRequestHistoryForUser returns newest-first history", async () => {
    const history = [
      { id: "cycle-2", status: AGENT_UPGRADE_REQUEST_STATUS.PENDING },
      { id: "cycle-1", status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED },
    ];
    supabase.from.mockReturnValue(chain({ data: history, error: null }));

    const { data } = await fetchAgentUpgradeRequestHistoryForUser("user-1");
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe("cycle-2");
  });

  test("canSubmitAgentUpgradeRequest blocks when pending exists", () => {
    expect(
      canSubmitAgentUpgradeRequest({
        profileRole: "user",
        pendingRequest: { id: "p1", status: AGENT_UPGRADE_REQUEST_STATUS.PENDING },
      })
    ).toEqual({ canSubmit: false, reason: "pending_exists" });
  });

  test("canSubmitAgentUpgradeRequest allows resubmit after decline", () => {
    expect(
      canSubmitAgentUpgradeRequest({
        profileRole: "user",
        pendingRequest: null,
      })
    ).toEqual({ canSubmit: true, reason: null });
  });

  test("canSubmitAgentUpgradeRequest blocks approved agent", () => {
    expect(
      canSubmitAgentUpgradeRequest({ profileRole: "agent", pendingRequest: null })
    ).toEqual({ canSubmit: false, reason: "already_agent" });
  });

  test("submitAgentUpgradeRequest creates pending cycle via RPC when available", async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        ok: true,
        upgrade_request_id: "new-cycle",
        cycle_id: "new-cycle",
        request: {
          id: "new-cycle",
          user_id: "user-1",
          status: AGENT_UPGRADE_REQUEST_STATUS.PENDING,
        },
      },
      error: null,
    });
    supabase.from.mockReturnValue(chain({ data: null, error: null }));

    const { data, error, cycleId } = await submitAgentUpgradeRequest({
      userId: "user-1",
      username: "testuser",
      email: "test@example.com",
      currentRole: "user",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("submit_agent_upgrade_request", {
      p_username: "testuser",
      p_email: "test@example.com",
    });
    expect(error).toBeNull();
    expect(data?.id).toBe("new-cycle");
    expect(cycleId).toBe("new-cycle");
  });

  test("submitAgentUpgradeRequest falls back to insert when RPC missing", async () => {
    const insertResult = {
      data: {
        id: "legacy-cycle",
        user_id: "user-1",
        status: AGENT_UPGRADE_REQUEST_STATUS.PENDING,
      },
      error: null,
    };
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function submit_agent_upgrade_request" },
    });
    let call = 0;
    supabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return chain({ data: null, error: null });
      }
      return chain(insertResult);
    });

    const { data, cycleId } = await submitAgentUpgradeRequest({
      userId: "user-1",
      currentRole: "user",
    });

    expect(data?.id).toBe("legacy-cycle");
    expect(cycleId).toBe("legacy-cycle");
  });

  test("submitAgentUpgradeRequest creates pending cycle on first submit (legacy path)", async () => {
    const insertResult = {
      data: {
        id: "new-cycle",
        user_id: "user-1",
        status: AGENT_UPGRADE_REQUEST_STATUS.PENDING,
      },
      error: null,
    };
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function submit_agent_upgrade_request" },
    });
    let call = 0;
    supabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return chain({ data: null, error: null });
      }
      const api = chain(insertResult);
      return api;
    });

    const { data, error } = await submitAgentUpgradeRequest({
      userId: "user-1",
      username: "testuser",
      email: "test@example.com",
      currentRole: "user",
    });

    expect(error).toBeNull();
    expect(data?.id).toBe("new-cycle");
    expect(getAgentUpgradeCycleId(data)).toBe("new-cycle");
  });

  test("submitAgentUpgradeRequest blocks duplicate pending before insert", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate_pending_request" },
    });
    supabase.from.mockReturnValue(
      chain({
        data: { id: "existing", status: AGENT_UPGRADE_REQUEST_STATUS.PENDING },
        error: null,
      })
    );

    const { data, error } = await submitAgentUpgradeRequest({
      userId: "user-1",
      currentRole: "user",
    });

    expect(data).toBeNull();
    expect(error?.message).toBe("duplicate_pending_request");
    expect(error?.code).toBe("23505");
  });

  test("new resubmit after decline produces different cycle id", async () => {
    const newCycle = {
      id: "cycle-2-new",
      user_id: "user-1",
      status: AGENT_UPGRADE_REQUEST_STATUS.PENDING,
    };
    supabase.rpc.mockResolvedValue({
      data: {
        ok: true,
        upgrade_request_id: "cycle-2-new",
        request: newCycle,
      },
      error: null,
    });
    supabase.from.mockReturnValue(chain({ data: null, error: null }));

    const { data } = await submitAgentUpgradeRequest({
      userId: "user-1",
      currentRole: "user",
    });

    expect(data?.id).toBe("cycle-2-new");
    expect(data?.id).not.toBe("cycle-1-old");
  });

  test("resolveAgentUpgradeRequest uses RPC and returns idempotent result", async () => {
    supabase.rpc.mockResolvedValue({
      data: { ok: true, idempotent: true, cycle_id: "req-1", status: "rejected" },
      error: null,
    });

    const result = await resolveAgentUpgradeRequest({
      requestId: "req-1",
      reviewerId: "admin-1",
      nextStatus: AGENT_UPGRADE_REQUEST_STATUS.REJECTED,
      userId: "user-1",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("resolve_agent_upgrade_request", {
      p_request_id: "req-1",
      p_next_status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED,
      p_user_id: "user-1",
    });
    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(true);
    expect(result.cycleId).toBe("req-1");
  });
});
