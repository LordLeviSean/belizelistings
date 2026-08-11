/** @jest-environment node */

import {
  PUSH_NAVIGATE_MESSAGE_TYPE,
  flushPendingPushNavigation,
  handlePushNavigateMessage,
  isSafePushNavigateHref,
} from "./pushNotificationNavigation";

describe("pushNotificationNavigation", () => {
  test("accepts relative dashboard inbox deep links", () => {
    expect(
      isSafePushNavigateHref("/dashboard/user?tab=inbox&conversation=conv-123")
    ).toBe(true);
  });

  test("rejects external and protocol-relative destinations", () => {
    expect(isSafePushNavigateHref("https://evil.example")).toBe(false);
    expect(isSafePushNavigateHref("//evil.example")).toBe(false);
  });

  test("navigates existing client to exact agent_replied thread URL", () => {
    const push = jest.fn();
    const handled = handlePushNavigateMessage(
      {
        type: PUSH_NAVIGATE_MESSAGE_TYPE,
        href: "/dashboard/user?tab=inbox&conversation=conv-buyer-1",
      },
      { push }
    );

    expect(handled).toBe(true);
    expect(push).toHaveBeenCalledWith("/dashboard/user?tab=inbox&conversation=conv-buyer-1");
  });

  test("navigates existing client to exact viewing_declined dashboard URL", () => {
    const push = jest.fn();
    const handled = handlePushNavigateMessage(
      {
        type: PUSH_NAVIGATE_MESSAGE_TYPE,
        href: "/dashboard/user?tab=viewings&viewing=42",
      },
      { push }
    );

    expect(handled).toBe(true);
    expect(push).toHaveBeenCalledWith("/dashboard/user?tab=viewings&viewing=42");
  });

  test("push navigation from unrelated page reaches buyer dashboard viewings tab", () => {
    const push = jest.fn();
    const handled = handlePushNavigateMessage(
      {
        type: PUSH_NAVIGATE_MESSAGE_TYPE,
        href: "/dashboard/user?tab=viewings&viewing=108",
      },
      { push }
    );

    expect(handled).toBe(true);
    expect(push).toHaveBeenCalledWith("/dashboard/user?tab=viewings&viewing=108");
  });

  test("defers push navigation until router is ready", () => {
    const push = jest.fn();
    const pendingHrefRef = { current: null };

    const handled = handlePushNavigateMessage(
      {
        type: PUSH_NAVIGATE_MESSAGE_TYPE,
        href: "/dashboard/user?tab=viewings&viewing=42",
      },
      { push, isReady: false },
      { pendingHrefRef }
    );

    expect(handled).toBe(true);
    expect(push).not.toHaveBeenCalled();
    expect(pendingHrefRef.current).toBe("/dashboard/user?tab=viewings&viewing=42");

    const flushed = flushPendingPushNavigation(pendingHrefRef, { push, isReady: true });
    expect(flushed).toBe(true);
    expect(push).toHaveBeenCalledWith("/dashboard/user?tab=viewings&viewing=42");
    expect(pendingHrefRef.current).toBeNull();
  });

  test("agent_replied deep links still navigate immediately when router is ready", () => {
    const push = jest.fn();
    const handled = handlePushNavigateMessage(
      {
        type: PUSH_NAVIGATE_MESSAGE_TYPE,
        href: "/dashboard/user?tab=inbox&conversation=conv-agent-replied",
      },
      { push, isReady: true }
    );

    expect(handled).toBe(true);
    expect(push).toHaveBeenCalledWith("/dashboard/user?tab=inbox&conversation=conv-agent-replied");
  });
});
