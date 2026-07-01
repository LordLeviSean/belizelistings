import {
  isInquiryEmailReadOnly,
  resolveInquirySenderEmail,
} from "./inquiryEmailPrefill";

describe("inquiryEmailPrefill", () => {
  test("guest returns empty email", () => {
    expect(resolveInquirySenderEmail(null, null)).toBe("");
    expect(isInquiryEmailReadOnly(null)).toBe(false);
  });

  test("logged-in prefers profile email over session email", () => {
    const user = { id: "u1", email: "session@example.com" };
    const profile = { email: "profile@example.com" };
    expect(resolveInquirySenderEmail(user, profile)).toBe("profile@example.com");
    expect(isInquiryEmailReadOnly(user)).toBe(true);
  });

  test("logged-in falls back to session email", () => {
    const user = { id: "u1", email: "session@example.com" };
    expect(resolveInquirySenderEmail(user, null)).toBe("session@example.com");
  });
});
