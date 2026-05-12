import { formatWelcomeGreeting, resolveDashboardGreetingName } from "./dashboardGreeting";

describe("resolveDashboardGreetingName", () => {
  it("prefers username", () => {
    expect(
      resolveDashboardGreetingName({
        username: "belize_host",
        email: "x@y.com",
        full_name: "Full",
      })
    ).toBe("belize_host");
  });

  it("falls back to email local-part", () => {
    expect(resolveDashboardGreetingName({ email: "Jane.Doe@site.bz" })).toBe("Jane.Doe");
  });

  it("falls back to full_name", () => {
    expect(resolveDashboardGreetingName({ full_name: "Pat" })).toBe("Pat");
  });

  it("returns empty when nothing usable", () => {
    expect(resolveDashboardGreetingName({})).toBe("");
  });
});

describe("formatWelcomeGreeting", () => {
  it("uses name when present", () => {
    expect(formatWelcomeGreeting({ username: "host" })).toBe("Welcome, host!");
  });

  it("generic when no name", () => {
    expect(formatWelcomeGreeting({})).toBe("Welcome!");
  });
});
