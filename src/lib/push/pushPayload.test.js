/** @jest-environment node */

import { buildPushPayload, isSafePushDeepLink, serializePushPayload } from "./pushPayload";

describe("pushPayload", () => {
  test("accepts same-origin relative deep links", () => {
    expect(isSafePushDeepLink("/dashboard/user?tab=inbox&conversation=abc")).toBe(true);
    expect(isSafePushDeepLink("https://evil.example/phish")).toBe(false);
    expect(isSafePushDeepLink("//evil.example/phish")).toBe(false);
    expect(isSafePushDeepLink("javascript:alert(1)")).toBe(false);
  });

  test("builds minimal payload without auth tokens or external URLs", () => {
    const built = buildPushPayload({
      notificationId: "11111111-1111-1111-1111-111111111111",
      eventType: "new_inquiry",
      title: "New inquiry",
      body: "A buyer contacted you about Sunset Villa.",
      href: "/dashboard/agent?tab=inbox&conversation=abc",
      tag: "new_inquiry:11111111-1111-1111-1111-111111111111",
    });

    expect(built.ok).toBe(true);
    expect(built.payload).toEqual(
      expect.objectContaining({
        notificationId: "11111111-1111-1111-1111-111111111111",
        eventType: "new_inquiry",
        title: "New inquiry",
        href: "/dashboard/agent?tab=inbox&conversation=abc",
      })
    );
    expect(JSON.stringify(built.payload)).not.toMatch(/token|bearer|authorization/i);
  });

  test("rejects unsafe deep links", () => {
    const built = buildPushPayload({
      notificationId: "11111111-1111-1111-1111-111111111111",
      eventType: "new_inquiry",
      title: "New inquiry",
      href: "https://phish.example",
    });
    expect(built).toEqual({ ok: false, error: "unsafe_deep_link" });
  });

  test("serializePushPayload returns compact JSON", () => {
    const built = buildPushPayload({
      notificationId: "11111111-1111-1111-1111-111111111111",
      eventType: "viewing_confirmed",
      title: "Viewing confirmed",
      body: "Tomorrow at 10:00",
      href: "/dashboard/user?tab=viewings&viewing=1",
    });
    expect(serializePushPayload(built)).toBe(JSON.stringify(built.payload));
  });
});
