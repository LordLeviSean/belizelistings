import {
  clearProfileSession,
  getCachedProfileRow,
  isProfileHydratedForUser,
  markProfileHydrated,
  runProfileHydrateOnce,
} from "./profileSessionCache";

describe("profileSessionCache", () => {
  beforeEach(() => {
    clearProfileSession();
  });

  it("marks and reads hydration for one user", () => {
    markProfileHydrated("u1", { id: "u1", role: "user" });
    expect(isProfileHydratedForUser("u1")).toBe(true);
    expect(getCachedProfileRow("u1")).toEqual({ id: "u1", role: "user" });
    expect(isProfileHydratedForUser("u2")).toBe(false);
  });

  it("runProfileHydrateOnce runs fetch only once per user", async () => {
    const run = jest.fn().mockResolvedValue({ id: "u1", role: "user" });
    await runProfileHydrateOnce("u1", run);
    await runProfileHydrateOnce("u1", run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("clearProfileSession resets hydration", () => {
    markProfileHydrated("u1", { id: "u1" });
    clearProfileSession();
    expect(isProfileHydratedForUser("u1")).toBe(false);
  });

  it("runProfileHydrateOnce does not reuse inflight for a different user", async () => {
    let resolveU1;
    const u1Promise = new Promise((resolve) => {
      resolveU1 = resolve;
    });
    const runU1 = jest.fn(() => u1Promise);
    const runU2 = jest.fn().mockResolvedValue({ id: "u2", role: "agent" });

    const p1 = runProfileHydrateOnce("u1", runU1);
    const p2 = runProfileHydrateOnce("u2", runU2);

    resolveU1({ id: "u1", role: "user" });
    await p1;
    const row2 = await p2;

    expect(runU1).toHaveBeenCalledTimes(1);
    expect(runU2).toHaveBeenCalledTimes(1);
    expect(row2).toEqual({ id: "u2", role: "agent" });
    expect(isProfileHydratedForUser("u2")).toBe(true);
    expect(getCachedProfileRow("u2")).toEqual({ id: "u2", role: "agent" });
  });
});
