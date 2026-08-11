/** @jest-environment node */

import {
  PUSH_NAVIGATE_MESSAGE_TYPE,
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
});
