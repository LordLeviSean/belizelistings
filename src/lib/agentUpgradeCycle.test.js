import {
  deriveAgentUpgradeSubmissionEligibility,
  deriveAgentUpgradeUiState,
  getAgentUpgradeCycleId,
  isPendingAgentUpgradeRequest,
  isResolvedAgentUpgradeRequest,
  resolveCurrentAgentUpgradeCycle,
} from "./agentUpgradeCycle";
import { AGENT_UPGRADE_REQUEST_STATUS } from "@/constants/agentUpgradeNotifications";

const cycle = (overrides = {}) => ({
  id: "cycle-a",
  user_id: "user-1",
  status: AGENT_UPGRADE_REQUEST_STATUS.PENDING,
  requested_at: "2026-07-01T12:00:00.000Z",
  ...overrides,
});

describe("agentUpgradeCycle", () => {
  describe("getAgentUpgradeCycleId", () => {
    test("returns row id as canonical cycle id", () => {
      expect(getAgentUpgradeCycleId(cycle({ id: "uuid-123" }))).toBe("uuid-123");
    });

    test("returns null when request missing", () => {
      expect(getAgentUpgradeCycleId(null)).toBeNull();
    });
  });

  describe("deriveAgentUpgradeSubmissionEligibility", () => {
    test("first submission allowed for platform user", () => {
      expect(
        deriveAgentUpgradeSubmissionEligibility({ profileRole: "user", pendingRequest: null })
      ).toEqual({ canSubmit: true, reason: null });
    });

    test("duplicate submit while pending is blocked", () => {
      expect(
        deriveAgentUpgradeSubmissionEligibility({
          profileRole: "user",
          pendingRequest: cycle(),
        })
      ).toEqual({ canSubmit: false, reason: "pending_exists" });
    });

    test("declined user may submit a new cycle when no pending row", () => {
      expect(
        deriveAgentUpgradeSubmissionEligibility({
          profileRole: "user",
          pendingRequest: null,
        })
      ).toEqual({ canSubmit: true, reason: null });
    });

    test("approved agent cannot submit again", () => {
      expect(
        deriveAgentUpgradeSubmissionEligibility({ profileRole: "agent", pendingRequest: null })
      ).toEqual({ canSubmit: false, reason: "already_agent" });
    });

    test("admin role cannot submit", () => {
      expect(
        deriveAgentUpgradeSubmissionEligibility({ profileRole: "admin", pendingRequest: null })
      ).toEqual({ canSubmit: false, reason: "role_ineligible" });
    });
  });

  describe("resolveCurrentAgentUpgradeCycle", () => {
    test("pending request is current cycle", () => {
      const pending = cycle({ id: "pending-1" });
      const historical = cycle({
        id: "old-rejected",
        status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED,
      });
      expect(
        resolveCurrentAgentUpgradeCycle({ pendingRequest: pending, latestRequest: historical })
      ).toBe(pending);
    });

    test("falls back to latest when no pending", () => {
      const historical = cycle({
        id: "old-rejected",
        status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED,
      });
      expect(
        resolveCurrentAgentUpgradeCycle({ pendingRequest: null, latestRequest: historical })
      ).toBe(historical);
    });
  });

  describe("deriveAgentUpgradeUiState", () => {
    test("shows pending review for active pending cycle", () => {
      expect(
        deriveAgentUpgradeUiState({
          profileRole: "user",
          pendingRequest: cycle({ id: "cycle-2" }),
        })
      ).toEqual({ phase: "pending_review", cycleId: "cycle-2" });
    });

    test("shows declined resubmit when latest resolved is rejected", () => {
      expect(
        deriveAgentUpgradeUiState({
          profileRole: "user",
          pendingRequest: null,
          latestResolvedRequest: cycle({
            id: "cycle-1",
            status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED,
          }),
        })
      ).toEqual({ phase: "declined_resubmit", cycleId: "cycle-1" });
    });

    test("agent profile shows approved active regardless of history", () => {
      expect(
        deriveAgentUpgradeUiState({
          profileRole: "agent",
          latestResolvedRequest: cycle({
            id: "cycle-3",
            status: AGENT_UPGRADE_REQUEST_STATUS.APPROVED,
          }),
        })
      ).toEqual({ phase: "approved_active", cycleId: "cycle-3" });
    });

    test("historical rejected does not block when new pending exists", () => {
      const ui = deriveAgentUpgradeUiState({
        profileRole: "user",
        pendingRequest: cycle({ id: "cycle-new" }),
        latestResolvedRequest: cycle({
          id: "cycle-old",
          status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED,
        }),
      });
      expect(ui.phase).toBe("pending_review");
      expect(ui.cycleId).toBe("cycle-new");
    });
  });

  describe("status helpers", () => {
    test("isPendingAgentUpgradeRequest", () => {
      expect(isPendingAgentUpgradeRequest(cycle())).toBe(true);
      expect(
        isPendingAgentUpgradeRequest(
          cycle({ status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED })
        )
      ).toBe(false);
    });

    test("isResolvedAgentUpgradeRequest", () => {
      expect(
        isResolvedAgentUpgradeRequest(
          cycle({ status: AGENT_UPGRADE_REQUEST_STATUS.APPROVED })
        )
      ).toBe(true);
      expect(
        isResolvedAgentUpgradeRequest(
          cycle({ status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED })
        )
      ).toBe(true);
      expect(isResolvedAgentUpgradeRequest(cycle())).toBe(false);
    });
  });

  describe("multi-cycle independence", () => {
    test("new cycle has different id from previous declined cycle", () => {
      const cycle1 = cycle({
        id: "11111111-1111-1111-1111-111111111111",
        status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED,
      });
      const cycle2 = cycle({
        id: "22222222-2222-2222-2222-222222222222",
        status: AGENT_UPGRADE_REQUEST_STATUS.PENDING,
      });
      expect(getAgentUpgradeCycleId(cycle1)).not.toBe(getAgentUpgradeCycleId(cycle2));
    });

    test("previous declined cycle remains historical (resolved status)", () => {
      const historical = cycle({
        id: "historical",
        status: AGENT_UPGRADE_REQUEST_STATUS.REJECTED,
        reviewed_at: "2026-07-01T12:00:00.000Z",
      });
      expect(isResolvedAgentUpgradeRequest(historical)).toBe(true);
      expect(isPendingAgentUpgradeRequest(historical)).toBe(false);
    });
  });
});
