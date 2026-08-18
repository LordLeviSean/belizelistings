/** @jest-environment node */

import {
  DELIVERY_MODES,
  deriveDeliveryMode,
  deriveHealthIndicator,
  filterNotificationDiagnosticRows,
  formatDeliveryLatency,
  formatMaskedSubscriptionLabel,
  formatShortId,
  maskPushSubscriptionEndpoint,
  parseNotificationDiagnosticsQuery,
  projectNotificationDiagnosticRow,
  readEntityRefs,
  summarizeNotificationDiagnostics,
} from "./notificationDiagnostics";

describe("notificationDiagnostics mapping", () => {
  test("formatShortId shortens long identifiers", () => {
    expect(formatShortId("conv-1234567890abcdef")).toBe("conv…cdef");
  });

  test("maskPushSubscriptionEndpoint hides full endpoint", () => {
    expect(maskPushSubscriptionEndpoint("https://push.example/device/abc123a82f")).toBe("…a82f");
    expect(formatMaskedSubscriptionLabel("iOS", "https://push.example/device/abc123a82f")).toBe(
      "iOS • subscription …a82f"
    );
  });

  test("formatDeliveryLatency renders seconds and minutes", () => {
    expect(formatDeliveryLatency(0, 1400)).toBe("1.4s");
    expect(formatDeliveryLatency(0, 159_000)).toBe("2m 39s");
  });

  test("readEntityRefs extracts conversation/viewing/listing/message ids", () => {
    expect(
      readEntityRefs({
        conversation_id: "conv-1",
        viewing_id: "42",
        listing_id: "108",
        message_id: "msg-1",
        dedupe_key: "buyer_replied:msg-1:agent-1",
        sender_role: "buyer",
      })
    ).toEqual({
      conversationId: "conv-1",
      viewingId: "42",
      listingId: "108",
      inquiryId: null,
      messageId: "msg-1",
      dedupeKey: "buyer_replied:msg-1:agent-1",
      senderRole: "buyer",
      senderName: null,
    });
  });

  test("projectNotificationDiagnosticRow correlates queue, inbox, push, and href", () => {
    const row = projectNotificationDiagnosticRow({
      queueRow: {
        id: "queue-1",
        event_type: "buyer_replied",
        recipient_id: "agent-1",
        status: "sent",
        attempts: 1,
        created_at: "2026-08-18T10:00:00.000Z",
        processed_at: "2026-08-18T10:00:01.000Z",
        payload: {
          conversation_id: "conv-1",
          message_id: "msg-1",
          dedupe_key: "buyer_replied:msg-1:agent-1",
        },
      },
      notificationRow: {
        id: "notif-1",
        recipient_user_id: "agent-1",
        event_type: "buyer_replied",
        title: "Buyer replied",
        body: "Alexis Marie replied about Finca Solana.",
        dedupe_key: "buyer_replied:msg-1:agent-1",
        queue_id: "queue-1",
        created_at: "2026-08-18T10:00:01.100Z",
        payload: {
          conversation_id: "conv-1",
          message_id: "msg-1",
          _web_push: {
            status: "delivered",
            attempted_at: "2026-08-18T10:00:01.200Z",
            delivered_at: "2026-08-18T10:00:01.400Z",
            delivered_count: 1,
          },
        },
      },
      recipientProfile: { id: "agent-1", username: "coastal_realty", role: "agent" },
      subscriptions: [
        {
          id: "sub-1",
          endpoint: "https://push.example/device/abc123a82f",
          platform_label: "iOS",
          is_active: true,
        },
      ],
    });

    expect(row.queueId).toBe("queue-1");
    expect(row.notificationId).toBe("notif-1");
    expect(row.inbox.status).toBe("created");
    expect(row.push.status).toBe("delivered");
    expect(row.navigation.href).toBe("/dashboard/agent?tab=inbox&conversation=conv-1");
    expect(row.deliveryLatency).toBe("1.4s");
    expect(row.deliveryMode).toBe(DELIVERY_MODES.IMMEDIATE_API);
    expect(row.push.subscriptions[0].label).toBe("iOS • subscription …a82f");
    expect(row.navigation.clickTracked).toBe(false);
  });

  test("deriveDeliveryMode marks in-app-only events without push attempts", () => {
    expect(
      deriveDeliveryMode({
        eventType: "listing_approved",
        queueRow: { created_at: "2026-08-18T10:00:00.000Z", status: "sent" },
        notificationRow: { payload: {} },
        pushState: { status: "not_attempted" },
      })
    ).toBe(DELIVERY_MODES.IN_APP_ONLY);
  });

  test("deriveDeliveryMode marks cron recovery from slow queue processing", () => {
    expect(
      deriveDeliveryMode({
        eventType: "new_inquiry",
        queueRow: {
          created_at: "2026-08-18T10:00:00.000Z",
          processed_at: "2026-08-18T10:01:10.000Z",
          status: "sent",
        },
        notificationRow: {
          payload: {
            _web_push: {
              status: "delivered",
              delivered_at: "2026-08-18T10:01:12.000Z",
            },
          },
        },
      })
    ).toBe(DELIVERY_MODES.CRON_RECOVERY);
  });

  test("deriveHealthIndicator maps push and queue states", () => {
    expect(deriveHealthIndicator("delivered", "sent")).toBe("Delivered");
    expect(deriveHealthIndicator("no_subscription", "sent")).toBe("No subscription");
    expect(deriveHealthIndicator("not_attempted", "sent")).toBe("In-app only");
    expect(deriveHealthIndicator("failed", "failed")).toBe("Failed");
  });

  test("filterNotificationDiagnosticRows supports push status and entity search", () => {
    const rows = [
      {
        push: { status: "delivered" },
        deliveryMode: DELIVERY_MODES.IMMEDIATE_API,
        entity: { conversationId: "conv-abc", dedupeKey: "buyer_replied:msg-a:agent-1" },
      },
      {
        push: { status: "no_subscription" },
        deliveryMode: DELIVERY_MODES.IN_APP_ONLY,
        entity: { viewingId: "108" },
      },
    ];

    expect(
      filterNotificationDiagnosticRows(rows, {
        pushStatus: "delivered",
        deliveryMode: "",
        entityId: "",
        search: "",
      })
    ).toHaveLength(1);

    expect(
      filterNotificationDiagnosticRows(rows, {
        pushStatus: "",
        deliveryMode: "",
        entityId: "",
        search: "conv-abc",
      })
    ).toHaveLength(1);
  });

  test("summarizeNotificationDiagnostics aggregates health counts", () => {
    const summary = summarizeNotificationDiagnostics([
      {
        push: { status: "delivered" },
        queue: { status: "sent" },
        deliveryMode: DELIVERY_MODES.IMMEDIATE_API,
      },
      {
        push: { status: "no_subscription" },
        queue: { status: "sent" },
        deliveryMode: DELIVERY_MODES.IN_APP_ONLY,
      },
      {
        push: { status: "failed" },
        queue: { status: "failed" },
        deliveryMode: DELIVERY_MODES.UNKNOWN,
      },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.pushDelivered).toBe(1);
    expect(summary.noSubscription).toBe(1);
    expect(summary.failed).toBe(1);
  });

  test("parseNotificationDiagnosticsQuery parses filters and caps limit", () => {
    const filters = parseNotificationDiagnosticsQuery({
      query: {
        limit: "500",
        eventType: "buyer_replied",
        pushStatus: "delivered",
        search: "conv-1",
      },
    });

    expect(filters.limit).toBe(100);
    expect(filters.eventType).toBe("buyer_replied");
    expect(filters.pushStatus).toBe("delivered");
    expect(filters.search).toBe("conv-1");
  });
});
