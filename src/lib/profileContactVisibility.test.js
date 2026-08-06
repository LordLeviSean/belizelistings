/** @jest-environment node */

import {
  applyPublicContactVisibility,
  buildPublicAgentProfileContact,
  hasExplicitPublicEmailConsent,
  isEmailPubliclyVisible,
  isPhonePubliclyVisible,
  resolvePublicContactEmail,
  resolvePublicContactPhone,
} from "./profileContactVisibility";

describe("profileContactVisibility", () => {
  test("phone is public by default unless explicitly disabled", () => {
    expect(isPhonePubliclyVisible({ show_phone_public: true })).toBe(true);
    expect(isPhonePubliclyVisible({})).toBe(true);
    expect(isPhonePubliclyVisible({ show_phone_public: false })).toBe(false);
  });

  test("email requires explicit consent via contact_email_display", () => {
    expect(
      isEmailPubliclyVisible({
        show_email_public: true,
        contact_email_display: "agent@example.com",
      })
    ).toBe(true);
    expect(
      isEmailPubliclyVisible({
        show_email_public: true,
        email: "agent@example.com",
      })
    ).toBe(false);
    expect(
      isEmailPubliclyVisible({
        show_email_public: false,
        contact_email_display: "agent@example.com",
      })
    ).toBe(false);
  });

  test("legacy accounts with default show_email_public true but no display email stay hidden", () => {
    expect(
      hasExplicitPublicEmailConsent({
        show_email_public: true,
        contact_email_display: null,
      })
    ).toBe(false);
    expect(resolvePublicContactEmail({ show_email_public: true, email: "hidden@example.com" })).toBeNull();
  });

  test("applyPublicContactVisibility strips non-consented fields", () => {
    const sanitized = applyPublicContactVisibility(
      {
        displayName: "Levi Agent",
        email: "secret@example.com",
        phone: "+501 600 1234",
        whatsapp: "+501 600 1234",
        showEmailPublic: true,
        showPhonePublic: true,
      },
      { show_email_public: true, show_phone_public: true, contact_email_display: null }
    );
    expect(sanitized.email).toBeNull();
    expect(sanitized.phone).toBe("+501 600 1234");
    expect(sanitized.showEmailPublic).toBe(false);
  });

  test("public agent profile contact excludes hidden channels", () => {
    const contact = buildPublicAgentProfileContact({
      phone: "+501 622 0000",
      show_phone_public: true,
      show_email_public: true,
      email: "auth@example.com",
    });
    expect(contact.phone).toBe("+501 622 0000");
    expect(contact.email).toBeNull();
    expect(contact.hasDirectContact).toBe(true);
  });

  test("resolvePublicContactPhone respects phone visibility", () => {
    expect(resolvePublicContactPhone({ phone: "+501 600 1111", show_phone_public: false })).toBeNull();
    expect(resolvePublicContactPhone({ phone: "+501 600 1111", show_phone_public: true })).toBe(
      "+501 600 1111"
    );
  });
});
