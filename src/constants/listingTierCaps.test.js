const { PLATFORM_TIERS } = require("./operationalModel");
const {
  PUBLIC_USER_ACTIVE_LISTING_CAP,
  AGENT_ACTIVE_LISTING_CAP,
  BROKERAGE_ACTIVE_LISTING_CAP,
  resolveTierActiveListingCap,
} = require("./listingTierCaps");

describe("listingTierCaps", () => {
  const prevBeta = process.env.NEXT_PUBLIC_BETA_LISTING_CAP_OVERRIDE;

  afterEach(() => {
    if (prevBeta === undefined) delete process.env.NEXT_PUBLIC_BETA_LISTING_CAP_OVERRIDE;
    else process.env.NEXT_PUBLIC_BETA_LISTING_CAP_OVERRIDE = prevBeta;
  });

  test("production caps by tier", () => {
    delete process.env.NEXT_PUBLIC_BETA_LISTING_CAP_OVERRIDE;
    expect(resolveTierActiveListingCap(PLATFORM_TIERS.PUBLIC)).toBe(PUBLIC_USER_ACTIVE_LISTING_CAP);
    expect(PUBLIC_USER_ACTIVE_LISTING_CAP).toBe(5);
    expect(resolveTierActiveListingCap(PLATFORM_TIERS.AGENT_FREE)).toBe(AGENT_ACTIVE_LISTING_CAP);
    expect(AGENT_ACTIVE_LISTING_CAP).toBe(25);
    expect(resolveTierActiveListingCap(PLATFORM_TIERS.BROKERAGE)).toBe(BROKERAGE_ACTIVE_LISTING_CAP);
    expect(BROKERAGE_ACTIVE_LISTING_CAP).toBe(100);
    expect(resolveTierActiveListingCap(PLATFORM_TIERS.ADMIN)).toBeNull();
  });

  test("beta override replaces tier caps when set", () => {
    process.env.NEXT_PUBLIC_BETA_LISTING_CAP_OVERRIDE = "10";
    expect(resolveTierActiveListingCap(PLATFORM_TIERS.PUBLIC)).toBe(10);
    expect(resolveTierActiveListingCap(PLATFORM_TIERS.AGENT_FREE)).toBe(10);
  });
});
