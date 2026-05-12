import { normalizeUsername, validateUsernameCandidate, validateSignupUsername } from "./usernameRules";

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Host_Name  ")).toBe("host_name");
  });
});

describe("validateUsernameCandidate", () => {
  it("accepts valid handles", () => {
    expect(validateUsernameCandidate("host_01")).toEqual({ ok: true, username: "host_01" });
    expect(validateUsernameCandidate("a.b-c")).toEqual({ ok: true, username: "a.b-c" });
  });

  it("rejects empty", () => {
    expect(validateUsernameCandidate("   ").ok).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(validateUsernameCandidate("bad space").ok).toBe(false);
    expect(validateUsernameCandidate("bad@").ok).toBe(false);
  });
});

describe("validateSignupUsername", () => {
  it("requires 3+ characters", () => {
    expect(validateSignupUsername("ab").ok).toBe(false);
    expect(validateSignupUsername("ab").code).toBe("short");
  });

  it("accepts valid signup handles", () => {
    expect(validateSignupUsername("host_01")).toEqual({ ok: true, username: "host_01" });
  });

  it("rejects invalid pattern with friendly copy", () => {
    const r = validateSignupUsername("bad!");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("letters");
  });
});
