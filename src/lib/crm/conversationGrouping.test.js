/** @jest-environment node */

import {
  CONVERSATION_DISPLAY_STATUS,
  conversationDisplayStatusLabel,
  getListingCoverUrl,
  groupConversationsByListing,
  resolveConversationDisplayStatus,
} from "./conversationGrouping";
import { CRM_PIPELINE_STAGE, INQUIRY_STATUS } from "./crmConstants";

describe("conversationGrouping", () => {
  test("getListingCoverUrl picks lowest position image", () => {
    expect(
      getListingCoverUrl({
        listing_images: [
          { image_url: "b.jpg", position: 2 },
          { image_url: "a.jpg", position: 0 },
        ],
      })
    ).toBe("a.jpg");
  });

  test("resolveConversationDisplayStatus maps new/read/replied", () => {
    expect(
      resolveConversationDisplayStatus({
        pipeline_stage: CRM_PIPELINE_STAGE.NEW_INQUIRY,
        listing_inquiries: { status: INQUIRY_STATUS.NEW, read_at: null },
      })
    ).toBe(CONVERSATION_DISPLAY_STATUS.NEW);

    expect(
      resolveConversationDisplayStatus({
        pipeline_stage: CRM_PIPELINE_STAGE.NEW_INQUIRY,
        listing_inquiries: { status: INQUIRY_STATUS.OPENED, read_at: "2026-01-01" },
        last_message_role: "buyer",
      })
    ).toBe(CONVERSATION_DISPLAY_STATUS.READ);

    expect(
      resolveConversationDisplayStatus({
        pipeline_stage: CRM_PIPELINE_STAGE.RESPONDED,
        listing_inquiries: { status: INQUIRY_STATUS.RESPONDED, read_at: "2026-01-01" },
        last_message_role: "agent",
      })
    ).toBe(CONVERSATION_DISPLAY_STATUS.REPLIED);
  });

  test("conversationDisplayStatusLabel returns readable labels", () => {
    expect(conversationDisplayStatusLabel(CONVERSATION_DISPLAY_STATUS.NEW)).toBe("New");
    expect(conversationDisplayStatusLabel(CONVERSATION_DISPLAY_STATUS.READ)).toBe("Read");
    expect(conversationDisplayStatusLabel(CONVERSATION_DISPLAY_STATUS.REPLIED)).toBe("Replied");
  });

  test("groupConversationsByListing groups, counts, and sorts", () => {
    const conversations = [
      {
        id: "c1",
        listing_id: 10,
        updated_at: "2026-06-01T12:00:00Z",
        pipeline_stage: CRM_PIPELINE_STAGE.NEW_INQUIRY,
        listing_inquiries: { status: INQUIRY_STATUS.NEW, read_at: null },
      },
      {
        id: "c2",
        listing_id: 20,
        updated_at: "2026-06-02T12:00:00Z",
        pipeline_stage: CRM_PIPELINE_STAGE.RESPONDED,
        listing_inquiries: { status: INQUIRY_STATUS.RESPONDED, read_at: "2026-06-01" },
        last_message_role: "agent",
      },
      {
        id: "c3",
        listing_id: 10,
        updated_at: "2026-06-03T12:00:00Z",
        pipeline_stage: CRM_PIPELINE_STAGE.NEW_INQUIRY,
        listing_inquiries: { status: INQUIRY_STATUS.OPENED, read_at: "2026-06-02" },
      },
    ];

    const groups = groupConversationsByListing(conversations, {
      10: { title: "Seafront Villa", listing_images: [{ image_url: "villa.jpg", position: 0 }] },
      20: { title: "Jungle Retreat" },
    });

    expect(groups).toHaveLength(2);
    expect(groups[0].listingId).toBe(10);
    expect(groups[0].title).toBe("Seafront Villa");
    expect(groups[0].thumbnailUrl).toBe("villa.jpg");
    expect(groups[0].totalCount).toBe(2);
    expect(groups[0].unreadCount).toBe(1);
    expect(groups[0].conversations.map((c) => c.id)).toEqual(["c3", "c1"]);
    expect(groups[1].listingId).toBe(20);
    expect(groups[1].unreadCount).toBe(0);
  });
});
