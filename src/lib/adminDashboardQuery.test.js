/** @jest-environment node */

import {
  ADMIN_CREATE_USER_QUERY_ACTION,
  omitRouterQueryParam,
  shouldOpenCreateUserModal,
} from "./adminDashboardQuery";

describe("adminDashboardQuery", () => {
  test("shouldOpenCreateUserModal matches the create-user action only", () => {
    expect(shouldOpenCreateUserModal(ADMIN_CREATE_USER_QUERY_ACTION)).toBe(true);
    expect(shouldOpenCreateUserModal([ADMIN_CREATE_USER_QUERY_ACTION])).toBe(true);
    expect(shouldOpenCreateUserModal(undefined)).toBe(false);
    expect(shouldOpenCreateUserModal("")).toBe(false);
    expect(shouldOpenCreateUserModal("delete-user")).toBe(false);
    expect(shouldOpenCreateUserModal(["create-user", "ignored"])).toBe(true);
  });

  test("omitRouterQueryParam removes action while preserving tab and unrelated params", () => {
    const query = {
      tab: "users",
      action: ADMIN_CREATE_USER_QUERY_ACTION,
      conversation: "conv-42",
    };
    expect(omitRouterQueryParam(query, "action")).toEqual({
      tab: "users",
      conversation: "conv-42",
    });
    expect(query).toEqual({
      tab: "users",
      action: ADMIN_CREATE_USER_QUERY_ACTION,
      conversation: "conv-42",
    });
  });

  test("omitRouterQueryParam preserves array-valued query parameters", () => {
    const query = {
      tab: "users",
      action: ADMIN_CREATE_USER_QUERY_ACTION,
      filter: ["pending", "approved"],
    };
    expect(omitRouterQueryParam(query, "action")).toEqual({
      tab: "users",
      filter: ["pending", "approved"],
    });
  });

  test("omitRouterQueryParam is a no-op when the key is absent", () => {
    expect(omitRouterQueryParam({ tab: "users" }, "action")).toEqual({ tab: "users" });
    expect(omitRouterQueryParam({}, "action")).toEqual({});
  });
});
