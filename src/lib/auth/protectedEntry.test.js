/** @jest-environment jsdom */

import {
  PENDING_PROTECTED_ENTRY_KEY,
  PROTECTED_ENTRY_PHASE,
  buildProtectedEntryHrefFromLocation,
  buildProtectedLoginHref,
  captureProtectedEntryFromWindow,
  clearPendingProtectedEntry,
  isProtectedDashboardPath,
  normalizeProtectedEntryHref,
  readPendingProtectedEntry,
  readProtectedEntryIntent,
  resolveProtectedEntryHref,
  resolveProtectedEntryPhase,
  savePendingProtectedEntry,
  shouldAcknowledgeProtectedEntry,
  shouldRunProtectedEntryRedirect,
} from "./protectedEntry";
import { normalizeReturnTo } from "../authEngagementReturn";

describe("protectedEntry", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.pushState({}, "", "/");
  });

  test("normalizeReturnTo rejects external and unsafe values", () => {
    expect(normalizeReturnTo("https://evil.com/x")).toBeNull();
    expect(normalizeReturnTo("//evil.com/x")).toBeNull();
    expect(normalizeReturnTo("/dashboard/user?tab=inbox&conversation=conv-1")).toBe(
      "/dashboard/user?tab=inbox&conversation=conv-1"
    );
  });

  test("isProtectedDashboardPath recognizes dashboard and admin routes", () => {
    expect(isProtectedDashboardPath("/dashboard/user")).toBe(true);
    expect(isProtectedDashboardPath("/dashboard/agent")).toBe(true);
    expect(isProtectedDashboardPath("/admin")).toBe(true);
    expect(isProtectedDashboardPath("/")).toBe(false);
  });

  test("captures canonical conversation href from window location", () => {
    window.history.pushState(
      {},
      "",
      "/dashboard/user?tab=inbox&conversation=conv-cold-1"
    );

    expect(captureProtectedEntryFromWindow()).toBe(
      "/dashboard/user?tab=inbox&conversation=conv-cold-1"
    );
    expect(readProtectedEntryIntent(captureProtectedEntryFromWindow())).toEqual({
      tab: "inbox",
      conversation: "conv-cold-1",
      viewing: null,
      listing: null,
    });
  });

  test("captures canonical viewing href from window location", () => {
    window.history.pushState({}, "", "/dashboard/agent?tab=viewings&viewing=view-9");

    expect(captureProtectedEntryFromWindow()).toBe(
      "/dashboard/agent?tab=viewings&viewing=view-9"
    );
  });

  test("sessionStorage preserves destination through bootstrap window", () => {
    savePendingProtectedEntry("/dashboard/user?tab=inbox&conversation=conv-store-1");
    expect(readPendingProtectedEntry()?.href).toBe(
      "/dashboard/user?tab=inbox&conversation=conv-store-1"
    );
  });

  test("resolveProtectedEntryHref prefers live URL over stale storage", () => {
    savePendingProtectedEntry("/dashboard/user?tab=inbox&conversation=conv-old");
    window.history.pushState(
      {},
      "",
      "/dashboard/user?tab=inbox&conversation=conv-url-wins"
    );

    expect(
      resolveProtectedEntryHref({
        router: {
          isReady: true,
          pathname: "/dashboard/user",
          asPath: "/dashboard/user?tab=inbox&conversation=conv-url-wins",
        },
        pendingFromStorage: readPendingProtectedEntry(),
      })
    ).toBe("/dashboard/user?tab=inbox&conversation=conv-url-wins");
  });

  test("router hydration keeps destination when query starts empty", () => {
    window.history.pushState(
      {},
      "",
      "/dashboard/user?tab=inbox&conversation=conv-hydrate"
    );

    expect(
      resolveProtectedEntryHref({
        router: { isReady: false, pathname: "/dashboard/user", asPath: "/dashboard/user" },
        pendingFromStorage: null,
      })
    ).toBe("/dashboard/user?tab=inbox&conversation=conv-hydrate");
  });

  test("resolveProtectedEntryPhase keeps session pending while auth restores", () => {
    expect(
      resolveProtectedEntryPhase({
        routerReady: true,
        authLoading: true,
        authSettled: false,
        user: null,
      })
    ).toBe(PROTECTED_ENTRY_PHASE.SESSION_PENDING);

    expect(
      resolveProtectedEntryPhase({
        routerReady: true,
        authLoading: false,
        authSettled: false,
        user: null,
      })
    ).toBe(PROTECTED_ENTRY_PHASE.SESSION_PENDING);
  });

  test("resolveProtectedEntryPhase redirects login only after auth settled with no user", () => {
    expect(
      resolveProtectedEntryPhase({
        routerReady: true,
        authLoading: false,
        authSettled: true,
        user: null,
      })
    ).toBe(PROTECTED_ENTRY_PHASE.REDIRECT_LOGIN);
  });

  test("resolveProtectedEntryPhase waits for role before redirect_role", () => {
    expect(
      resolveProtectedEntryPhase({
        routerReady: true,
        authLoading: false,
        authSettled: true,
        user: { id: "user-1" },
        role: "user",
        expectedRole: "agent",
      })
    ).toBe(PROTECTED_ENTRY_PHASE.REDIRECT_ROLE);
  });

  test("buildProtectedLoginHref preserves full destination", () => {
    expect(
      buildProtectedLoginHref("/dashboard/user?tab=inbox&conversation=conv-login-1")
    ).toBe("/login?returnTo=%2Fdashboard%2Fuser%3Ftab%3Dinbox%26conversation%3Dconv-login-1");
  });

  test("shouldAcknowledgeProtectedEntry requires Pass 1 entity intent match", () => {
    expect(
      shouldAcknowledgeProtectedEntry({
        pathname: "/dashboard/user",
        expectedRole: "user",
        role: "user",
        destinationHref: "/dashboard/user?tab=inbox&conversation=conv-ack",
        intent: { tab: "inbox", conversation: "conv-ack", viewing: null, listing: null },
      })
    ).toBe(true);

    expect(
      shouldAcknowledgeProtectedEntry({
        pathname: "/dashboard/user",
        expectedRole: "user",
        role: "user",
        destinationHref: "/dashboard/user?tab=inbox&conversation=conv-ack",
        intent: { tab: "inbox", conversation: "conv-other", viewing: null, listing: null },
      })
    ).toBe(false);
  });

  test("rapid navigation keeps newer explicit URL destination", () => {
    savePendingProtectedEntry("/dashboard/user?tab=inbox&conversation=conv-a");
    window.history.pushState(
      {},
      "",
      "/dashboard/user?tab=inbox&conversation=conv-b"
    );

    const resolved = resolveProtectedEntryHref({
      router: {
        isReady: true,
        pathname: "/dashboard/user",
        asPath: "/dashboard/user?tab=inbox&conversation=conv-b",
      },
      pendingFromStorage: readPendingProtectedEntry(),
    });

    expect(resolved).toBe("/dashboard/user?tab=inbox&conversation=conv-b");
    expect(resolved).not.toContain("conv-a");
  });

  test("acknowledgement clears pending destination from sessionStorage", () => {
    savePendingProtectedEntry("/dashboard/user?tab=inbox&conversation=conv-clear");
    clearPendingProtectedEntry();
    expect(sessionStorage.getItem(PENDING_PROTECTED_ENTRY_KEY)).toBeNull();
  });

  test("shouldRunProtectedEntryRedirect only on terminal redirect phases", () => {
    expect(shouldRunProtectedEntryRedirect(PROTECTED_ENTRY_PHASE.REDIRECT_LOGIN)).toBe(true);
    expect(shouldRunProtectedEntryRedirect(PROTECTED_ENTRY_PHASE.SESSION_PENDING)).toBe(false);
    expect(shouldRunProtectedEntryRedirect(PROTECTED_ENTRY_PHASE.READY)).toBe(false);
  });

  test("buildProtectedEntryHrefFromLocation rejects non-protected paths", () => {
    expect(
      buildProtectedEntryHrefFromLocation({ pathname: "/", search: "?tab=inbox" })
    ).toBeNull();
    expect(normalizeProtectedEntryHref("/listing/42")).toBeNull();
  });
});
