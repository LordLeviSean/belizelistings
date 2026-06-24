import {
  formatUserDashboardGreeting,
  formatUserDashboardSubtitle,
  formatWelcomeGreeting,
  resolveDashboardGreetingName,
} from "./dashboardGreeting";

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
    expect(formatWelcomeGreeting({})).toBe("Welcome back");
  });
});

describe("formatUserDashboardGreeting", () => {
  it("uses username only", () => {
    expect(formatUserDashboardGreeting({ username: "coral_reef" })).toBe("Welcome, coral_reef!");
  });

  it("ignores email and full_name", () => {
    expect(
      formatUserDashboardGreeting({
        username: "",
        email: "secret@example.com",
        full_name: "Secret Name",
      })
    ).toBe("Welcome back!");
  });

  it("fallback when missing username", () => {
    expect(formatUserDashboardGreeting({})).toBe("Welcome back!");
  });
});

describe("formatUserDashboardSubtitle", () => {
  it("combines username welcome with editorial tail", () => {
    expect(formatUserDashboardSubtitle({ username: "reef_runner" })).toBe(
      "Welcome, reef_runner! Explore Belize, save favorites, and manage your listings."
    );
  });

  it("uses welcome back clause without email", () => {
    expect(
      formatUserDashboardSubtitle({
        username: "",
        email: "x@y.com",
        full_name: "X",
      })
    ).toBe("Welcome back! Explore Belize, save favorites, and manage your listings.");
  });
});
