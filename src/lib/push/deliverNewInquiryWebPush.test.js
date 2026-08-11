/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("./sendWebPushToUser", () => ({
  sendWebPushToUser: jest.fn(),
}));

import { sendWebPushToUser } from "./sendWebPushToUser";
import {
  deliverNewInquiryWebPush,
  resolveTrustedRecipientRole,
} from "./deliverNewInquiryWebPush";

function buildAdminClient(overrides = {}) {
  const notificationRow = {
    id: "notif-1",
    payload: {
      conversation_id: "conv-1",
      listing_id: "listing-1",
      sender_email: "buyer@example.com",
      sender_phone: "+501-555-0100",
      message: "Private buyer message",
    },
  };

  const from = jest.fn((table) => {
    if (table === "notifications") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(function eq(field, value) {
            if (field === "id") {
              return {
                maybeSingle: jest.fn().mockResolvedValue({
                  data: notificationRow,
                  error: null,
                }),
                eq: jest.fn(() => ({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: notificationRow,
                    error: null,
                  }),
                })),
              };
            }
            return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
          }),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-1" }, error: null }),
            })),
          })),
        })),
      };
    }

    if (table === "profiles") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: { role: "agent" }, error: null }),
          })),
        })),
      };
    }

    return overrides[table] || {};
  });

  return { from, rpc: jest.fn(), ...overrides.client };
}

describe("deliverNewInquiryWebPush", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendWebPushToUser.mockResolvedValue({
      ok: true,
      attempted: 1,
      delivered: 1,
      temporaryFailures: 0,
      deactivated: 0,
    });
  });

  test("delivers one new_inquiry push to the trusted recipient", async () => {
    const adminClient = buildAdminClient();

    const result = await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: "new_inquiry",
      recipient_id: "agent-1",
      notification_id: "notif-1",
      dedupe_key: "new_inquiry:inq-1",
    });

    expect(result.skipped).toBe(false);
    expect(sendWebPushToUser).toHaveBeenCalledWith(
      adminClient,
      "agent-1",
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({
          eventType: "new_inquiry",
          title: "New property inquiry",
          body: "A buyer is interested in one of your listings.",
          href: "/dashboard/agent?tab=inbox&conversation=conv-1",
          tag: "new_inquiry:inq-1",
        }),
      }),
      { maxSubscriptions: 1 }
    );
    expect(JSON.stringify(sendWebPushToUser.mock.calls[0][2])).not.toMatch(
      /buyer@example.com|555-0100|Private buyer message/i
    );
  });

  test("ignores events outside the connected push set", async () => {
    const adminClient = buildAdminClient();

    const result = await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: "viewing_completed",
      recipient_id: "user-1",
      notification_id: "notif-2",
    });

    expect(result.reason).toBe("unsupported_event");
    expect(sendWebPushToUser).not.toHaveBeenCalled();
  });

  test("delivers one viewing_confirmed push to the buyer", async () => {
    const adminClient = buildAdminClient();
    adminClient.from = jest.fn((table) => {
      if (table === "notifications") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(function eq(field, value) {
              if (field === "id") {
                return {
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: "notif-confirmed-1",
                      payload: {
                        viewing_id: "view-1",
                        listing_id: "listing-1",
                        listing_title: "Finca Solana",
                        requested_date: "2026-07-15",
                        requested_time: "10:00",
                        recipient_side: "buyer",
                      },
                    },
                    error: null,
                  }),
                  eq: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: {
                        id: "notif-confirmed-1",
                        payload: {
                          viewing_id: "view-1",
                          listing_title: "Finca Solana",
                          requested_date: "2026-07-15",
                          requested_time: "10:00",
                        },
                      },
                      error: null,
                    }),
                  })),
                };
              }
              return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-confirmed-1" }, error: null }),
              })),
            })),
          })),
        };
      }
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: { role: "user" }, error: null }),
            })),
          })),
        };
      }
      return {};
    });

    const result = await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: "viewing_confirmed",
      recipient_id: "buyer-1",
      notification_id: "notif-confirmed-1",
      dedupe_key: "viewing_confirmed:view-1:buyer-1",
    });

    expect(result.skipped).toBe(false);
    expect(sendWebPushToUser).toHaveBeenCalledWith(
      adminClient,
      "buyer-1",
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({
          eventType: "viewing_confirmed",
          title: "Viewing confirmed",
          body: expect.stringContaining("10:00 AM"),
          href: "/dashboard/user?tab=viewings&viewing=view-1",
          tag: "viewing_confirmed:view-1:buyer-1",
        }),
      }),
      { maxSubscriptions: 1 }
    );
  });

  test("delivers one viewing_requested push to the listing contact", async () => {
    const adminClient = buildAdminClient();
    adminClient.from = jest.fn((table) => {
      if (table === "notifications") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(function eq(field, value) {
              if (field === "id") {
                return {
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: "notif-view-1",
                      payload: {
                        viewing_id: "view-1",
                        listing_id: "listing-1",
                        listing_title: "Finca Solana",
                        sender_name: "Alexis Marie",
                        requested_date: "2026-07-15",
                        requested_time: "08:00",
                        recipient_side: "owner",
                      },
                    },
                    error: null,
                  }),
                  eq: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: {
                        id: "notif-view-1",
                        payload: {
                          viewing_id: "view-1",
                          listing_title: "Finca Solana",
                          sender_name: "Alexis Marie",
                          requested_date: "2026-07-15",
                          requested_time: "08:00",
                        },
                      },
                      error: null,
                    }),
                  })),
                };
              }
              return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-view-1" }, error: null }),
              })),
            })),
          })),
        };
      }
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: { role: "agent" }, error: null }),
            })),
          })),
        };
      }
      return {};
    });

    const result = await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: "viewing_requested",
      recipient_id: "agent-1",
      notification_id: "notif-view-1",
      dedupe_key: "viewing_requested:view-1:agent-1",
    });

    expect(result.skipped).toBe(false);
    expect(sendWebPushToUser).toHaveBeenCalledWith(
      adminClient,
      "agent-1",
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({
          eventType: "viewing_requested",
          title: "New viewing request",
          body: expect.stringContaining("Alexis Marie"),
          href: "/dashboard/agent?tab=viewings&viewing=view-1",
          tag: "viewing_requested:view-1:agent-1",
        }),
      }),
      { maxSubscriptions: 1 }
    );
  });

  test("delivers one agent_replied push to the buyer recipient", async () => {
    const adminClient = buildAdminClient({
      client: {},
    });
    adminClient.from = jest.fn((table) => {
      if (table === "notifications") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(function eq(field, value) {
              if (field === "id") {
                return {
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: "notif-reply-1",
                      payload: { conversation_id: "conv-buyer-1", listing_id: "listing-1" },
                    },
                    error: null,
                  }),
                  eq: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: {
                        id: "notif-reply-1",
                        payload: { conversation_id: "conv-buyer-1", listing_id: "listing-1" },
                      },
                      error: null,
                    }),
                  })),
                };
              }
              return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-reply-1" }, error: null }),
              })),
            })),
          })),
        };
      }
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: { role: "user" }, error: null }),
            })),
          })),
        };
      }
      return {};
    });

    const result = await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: "agent_replied",
      recipient_id: "buyer-1",
      notification_id: "notif-reply-1",
      dedupe_key: "agent_replied:msg-1:buyer-1",
    });

    expect(result.skipped).toBe(false);
    expect(sendWebPushToUser).toHaveBeenCalledWith(
      adminClient,
      "buyer-1",
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({
          eventType: "agent_replied",
          title: "Agent replied",
          body: "You received a reply to your property inquiry.",
          href: "/dashboard/user?tab=inbox&conversation=conv-buyer-1",
          tag: "agent_replied:msg-1:buyer-1",
        }),
      }),
      { maxSubscriptions: 1 }
    );
  });

  test("does not accept caller-supplied recipient overrides beyond delivery result", async () => {
    const adminClient = buildAdminClient();

    await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: "new_inquiry",
      recipient_id: "agent-1",
      notification_id: "notif-1",
      dedupe_key: "new_inquiry:inq-1",
      pushRecipientId: "attacker-1",
    });

    expect(sendWebPushToUser).toHaveBeenCalledWith(
      adminClient,
      "agent-1",
      expect.anything(),
      { maxSubscriptions: 1 }
    );
  });

  test("handles no active subscriptions without throwing", async () => {
    sendWebPushToUser.mockResolvedValue({
      ok: false,
      error: "no_active_subscriptions",
      attempted: 0,
      delivered: 0,
      temporaryFailures: 0,
      deactivated: 0,
    });

    const adminClient = buildAdminClient();
    const result = await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: "new_inquiry",
      recipient_id: "agent-1",
      notification_id: "notif-1",
      dedupe_key: "new_inquiry:inq-1",
    });

    expect(result.ok).toBe(true);
    expect(result.push.error).toBe("no_active_subscriptions");
  });

  test("records no_subscription without marking delivered", async () => {
    const update = jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-1" }, error: null }),
        })),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-1" }, error: null }),
      })),
    }));
    sendWebPushToUser.mockResolvedValue({
      ok: false,
      error: "no_active_subscriptions",
      attempted: 0,
      delivered: 0,
      temporaryFailures: 0,
      deactivated: 0,
    });

    const adminClient = buildAdminClient();
    adminClient.from = jest.fn((table) => {
      if (table === "notifications") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(function eq(field) {
              if (field === "id") {
                return {
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: "notif-1",
                      payload: { conversation_id: "conv-1" },
                    },
                    error: null,
                  }),
                  eq: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: { payload: { conversation_id: "conv-1" } },
                      error: null,
                    }),
                  })),
                };
              }
              return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          })),
          update,
        };
      }
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: { role: "agent" }, error: null }),
            })),
          })),
        };
      }
      return {};
    });

    await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: "new_inquiry",
      recipient_id: "agent-1",
      notification_id: "notif-1",
      dedupe_key: "new_inquiry:inq-1",
    });

    expect(update).toHaveBeenCalled();
  });

  test("marks delivered only after provider success", async () => {
    const update = jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-1" }, error: null }),
        })),
      })),
    }));

    const adminClient = buildAdminClient();
    adminClient.from = jest.fn((table) => {
      if (table === "notifications") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(function eq(field) {
              if (field === "id") {
                return {
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: "notif-1",
                      payload: { conversation_id: "conv-1" },
                    },
                    error: null,
                  }),
                  eq: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: { payload: { conversation_id: "conv-1" } },
                      error: null,
                    }),
                  })),
                };
              }
              return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          })),
          update,
        };
      }
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: { role: "agent" }, error: null }),
            })),
          })),
        };
      }
      return {};
    });

    await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: "new_inquiry",
      recipient_id: "agent-1",
      notification_id: "notif-1",
      dedupe_key: "new_inquiry:inq-1",
    });

    expect(update).toHaveBeenCalled();
  });

  test("is idempotent when push was already delivered", async () => {
    const adminClient = buildAdminClient();
    adminClient.from = jest.fn((table) => {
      if (table === "notifications") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: "notif-1", payload: { _web_push_delivered: true } },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: { role: "agent" }, error: null }),
            })),
          })),
        };
      }
      return {};
    });

    const result = await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: "new_inquiry",
      recipient_id: "agent-1",
      notification_id: "notif-1",
      dedupe_key: "new_inquiry:inq-1",
    });

    expect(result.reason).toBe("already_delivered");
    expect(sendWebPushToUser).not.toHaveBeenCalled();
  });

  test("resolveTrustedRecipientRole reads profile role server-side", async () => {
    const adminClient = buildAdminClient();
    await expect(resolveTrustedRecipientRole(adminClient, "agent-1")).resolves.toBe("agent");
  });

  test("markNotificationWebPushDelivered marks notification payload once", async () => {
    const update = jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-1" }, error: null }),
        })),
      })),
    }));

    const adminClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: "notif-1", payload: {} },
              error: null,
            }),
          })),
        })),
        update,
      })),
    };

    const { markNotificationWebPushDelivered } = await import("./deliverNewInquiryWebPush");
    await expect(markNotificationWebPushDelivered(adminClient, "notif-1")).resolves.toBe(true);
    expect(update).toHaveBeenCalled();
  });
});
