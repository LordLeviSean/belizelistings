/** @jest-environment node */

import { INQUIRY_TYPE } from "./crmConstants";
import { filterInboxConversations, isViewingOnlyConversation } from "./conversationFilters";

describe("conversationFilters", () => {
  test("detects schedule_viewing synthetic threads", () => {
    expect(
      isViewingOnlyConversation({
        listing_inquiries: { inquiry_type: INQUIRY_TYPE.SCHEDULE_VIEWING },
      })
    ).toBe(true);
  });

  test("keeps general message conversations", () => {
    expect(
      isViewingOnlyConversation({
        listing_inquiries: { inquiry_type: INQUIRY_TYPE.GENERAL },
      })
    ).toBe(false);
  });

  test("filters viewing-only threads from inbox list", () => {
    const rows = [
      { id: "c1", listing_inquiries: { inquiry_type: INQUIRY_TYPE.SCHEDULE_VIEWING } },
      { id: "c2", listing_inquiries: { inquiry_type: INQUIRY_TYPE.GENERAL } },
    ];
    expect(filterInboxConversations(rows).map((r) => r.id)).toEqual(["c2"]);
  });

  test("legacy / hidden conversations are not revived by filter (caller omits deleted)", () => {
    const activeOnly = [
      { id: "alive", listing_inquiries: { inquiry_type: INQUIRY_TYPE.GENERAL } },
    ];
    expect(filterInboxConversations(activeOnly)).toHaveLength(1);
  });
});
