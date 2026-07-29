/** @jest-environment node */

import {
  resolveUserDashboardListingCap,
  formatAgentListingLimitExhaustedMessage,
} from "./dashboardAgentConfig";
import { AGENT_ACTIVE_LISTING_CAP } from "./listingTierCaps";

describe("dashboardAgentConfig listing limit copy", () => {
  test("exhausted message uses canonical agent cap", () => {
    const cap = resolveUserDashboardListingCap("agent_free");
    expect(cap).toBe(AGENT_ACTIVE_LISTING_CAP);
    expect(formatAgentListingLimitExhaustedMessage(cap)).toBe(
      "You have reached the maximum of 25 active listings for your account. Please archive, rent, or sell an existing listing before publishing another."
    );
  });
});
