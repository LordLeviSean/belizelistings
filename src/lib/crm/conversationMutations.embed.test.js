/** @jest-environment node */

import { CONVERSATION_INQUIRY_EMBED } from "./conversationMutations";

describe("conversationMutations embed contract", () => {
  test("CONVERSATION_INQUIRY_EMBED disambiguates listing_inquiries FK for PostgREST", () => {
    expect(CONVERSATION_INQUIRY_EMBED).toContain(
      "listing_inquiries!conversations_inquiry_id_fkey"
    );
    expect(CONVERSATION_INQUIRY_EMBED).not.toMatch(/^listing_inquiries\(/);
  });
});
