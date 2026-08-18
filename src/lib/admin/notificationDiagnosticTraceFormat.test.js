/** @jest-environment node */

import {
  assertDiagnosticTraceSafe,
  formatDiagnosticTraceTimestamp,
  formatNotificationDiagnosticTrace,
  formatNotificationDiagnosticsReport,
  parseDiagnosticNavigation,
} from "./notificationDiagnosticTraceFormat";

const sampleRow = {
  eventType: "viewing_confirmed",
  timestamp: "2026-08-18T16:32:14.000Z",
  recipient: { displayName: "Alexis Marie", shortId: "buye…1a2b", role: "user" },
  sender: { role: "agent", name: "Coastal Realty" },
  entity: {
    viewingId: "123",
    conversationId: null,
    listingId: "456",
    inquiryId: null,
    messageId: null,
    summary: { label: "Viewing 123" },
  },
  queueId: "queue-abcdef1234567890",
  notificationId: "notif-abcdef1234567890",
  queue: {
    status: "sent",
    attempts: 0,
    queuedAt: "2026-08-18T16:32:14.000Z",
    processedAt: "2026-08-18T16:32:15.000Z",
  },
  inbox: {
    status: "created",
    createdAt: "2026-08-18T16:32:15.100Z",
    title: "Viewing confirmed",
    body: "Your viewing was confirmed.",
    dedupeKey: "viewing_confirmed:123:buyer-1",
  },
  push: {
    status: "delivered",
    attemptedAt: "2026-08-18T16:32:15.200Z",
    deliveredAt: "2026-08-18T16:32:15.400Z",
    deliveredCount: 1,
    lastReason: null,
    subscriptions: [{ label: "iOS • subscription …a82f", id: "sub…a82f" }],
  },
  navigation: {
    href: "/dashboard/user?tab=viewings&viewing=123",
    clickTracked: false,
  },
  deliveryMode: "Immediate API",
  deliveryLatency: "1.3s",
  result: "Delivered",
};

describe("notificationDiagnosticTraceFormat", () => {
  test("formatNotificationDiagnosticTrace includes complete diagnostic sections", () => {
    const trace = formatNotificationDiagnosticTrace(sampleRow);

    expect(trace).toContain("# NOTIFICATION DIAGNOSTIC TRACE");
    expect(trace).toContain("Event Type: viewing_confirmed");
    expect(trace).toContain("Viewing ID: 123");
    expect(trace).toContain("Listing ID: 456");
    expect(trace).toContain("Conversation ID: —");
    expect(trace).toContain("Canonical Href:");
    expect(trace).toContain("/dashboard/user?tab=viewings&viewing=123");
    expect(trace).toContain("Delivery Latency: 1.3s");
    expect(trace).toContain("Delivery Mode: Immediate API");
    expect(trace).toContain("Client Click/Open Tracking: Not tracked");
    expect(trace).toContain("Queue → Inbox: PASS");
    expect(trace).toContain("Inbox → Push: PASS");
    expect(trace).toContain("Device: iOS • subscription …a82f");
  });

  test("missing fields render Unknown or Not available", () => {
    const trace = formatNotificationDiagnosticTrace({
      eventType: null,
      timestamp: null,
      recipient: {},
      sender: {},
      entity: {},
      queue: {},
      inbox: {},
      push: { status: "not_attempted", subscriptions: [] },
      navigation: {},
      deliveryMode: null,
    });

    expect(trace).toContain("Event Type: Unknown");
    expect(trace).toContain("Created: Not available");
    expect(trace).toContain("Actor Role: Unknown");
    expect(trace).toContain("Device: Not available");
    expect(trace).toContain("Canonical Href:");
    expect(trace).toContain("Not available");
  });

  test("parseDiagnosticNavigation extracts dashboard tab and entity param", () => {
    expect(parseDiagnosticNavigation("/dashboard/user?tab=viewings&viewing=123")).toEqual({
      dashboard: "user",
      tab: "viewings",
      entityParam: "viewing=123",
    });
  });

  test("formatNotificationDiagnosticsReport includes filters and record count", () => {
    const report = formatNotificationDiagnosticsReport({
      diagnostics: [sampleRow],
      filters: {
        eventType: "viewing_confirmed",
        queueStatus: "",
        pushStatus: "delivered",
        deliveryMode: "",
        search: "",
      },
      generatedAt: "2026-08-18T16:40:00.000Z",
      environment: "Production",
      recordsCopied: 1,
      totalAvailable: 120,
    });

    expect(report).toContain("BELIZELISTINGS NOTIFICATION DIAGNOSTICS");
    expect(report).toContain("Environment: Production");
    expect(report).toContain("Event Type: viewing_confirmed");
    expect(report).toContain("Push Status: delivered");
    expect(report).toContain("Records copied: 1");
    expect(report).toContain("Additional records may exist outside the loaded page.");
    expect(report).toContain("EVENT 1");
    expect(report).toContain("Canonical Href: /dashboard/user?tab=viewings&viewing=123");
  });

  test("formatDiagnosticTraceTimestamp uses America/Belize label", () => {
    const formatted = formatDiagnosticTraceTimestamp("2026-08-18T16:32:14.000Z");
    expect(formatted).toContain("America/Belize");
  });

  test("assertDiagnosticTraceSafe rejects secret-like content", () => {
    expect(() =>
      assertDiagnosticTraceSafe("Push endpoint auth_secret=abc123", sampleRow)
    ).toThrow(/Unsafe diagnostic trace content/);

    const safe = formatNotificationDiagnosticTrace(sampleRow);
    expect(assertDiagnosticTraceSafe(safe, sampleRow)).toBe(true);
    expect(safe).not.toContain("queue-abcdef1234567890");
    expect(safe).not.toMatch(/https:\/\/updates\.push/);
  });
});
