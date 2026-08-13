/** @jest-environment jsdom */

import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useParticipantEntityDeepLinkResolve } from "./useParticipantEntityDeepLinkResolve";
import { conversationListIncludesId } from "@/lib/crm/conversationDeepLink";
import { viewingListIncludesId } from "@/lib/crm/viewingDeepLink";

function createDeferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function DeepLinkHarness({
  participantUserId = "user-1",
  entityId = "entity-1",
  listLoading = false,
  initialList = [],
  fetchById,
  listIncludesTarget = conversationListIncludesId,
}) {
  const [list, setList] = useState(initialList);

  const handleFetched = useCallback((result) => {
    if (result.conversations) setList(result.conversations);
    if (result.viewings) setList(result.viewings);
  }, []);

  const resolveState = useParticipantEntityDeepLinkResolve({
    enabled: Boolean(participantUserId && entityId),
    participantUserId,
    entityId,
    listLoading,
    listIncludesTarget,
    getListSnapshot: () => list,
    getListingsByIdSnapshot: () => ({}),
    fetchById,
    onFetched: handleFetched,
  });

  return (
    <div>
      <div data-testid="resolve-state">{resolveState}</div>
      <div data-testid="list-count">{list.length}</div>
      <button type="button" data-testid="mutate-list" onClick={() => setList([{ id: "other" }])}>
        mutate
      </button>
    </div>
  );
}

function renderHarness(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<DeepLinkHarness {...props} />);
  });
  return { container, root };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useParticipantEntityDeepLinkResolve races", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = "";
  });

  test("conversation by-ID fetch survives generic list mutation while pending", async () => {
    const deferred = createDeferred();
    const fetchById = jest.fn(() => deferred.promise);

    const { container, root } = renderHarness({
      entityId: "conv-target",
      fetchById,
    });

    expect(container.querySelector('[data-testid="resolve-state"]').textContent).toBe("loading");

    await act(async () => {
      container.querySelector('[data-testid="mutate-list"]').click();
    });

    deferred.resolve({
      outcome: "resolved",
      fetched: true,
      conversations: [{ id: "conv-target" }],
      listingsById: {},
    });
    await flushPromises();

    expect(container.querySelector('[data-testid="resolve-state"]').textContent).toBe("resolved");
    expect(container.querySelector('[data-testid="list-count"]').textContent).toBe("1");
    expect(fetchById.mock.calls.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      root.unmount();
    });
  });

  test("viewing by-ID fetch survives generic list mutation while pending", async () => {
    const deferred = createDeferred();
    const fetchById = jest.fn(() => deferred.promise);

    const { container } = renderHarness({
      entityId: "123",
      listIncludesTarget: viewingListIncludesId,
      fetchById,
    });

    await act(async () => {
      container.querySelector('[data-testid="mutate-list"]').click();
    });

    deferred.resolve({
      outcome: "resolved",
      fetched: true,
      viewings: [{ id: "123" }],
      listingsById: {},
    });
    await flushPromises();

    expect(container.querySelector('[data-testid="resolve-state"]').textContent).toBe("resolved");
  });

  test("late response for 123 cannot overwrite navigation to 456", async () => {
    const deferred123 = createDeferred();
    const fetchById = jest.fn(({ entityId }) => {
      if (String(entityId) === "123") return deferred123.promise;
      return Promise.resolve({
        outcome: "resolved",
        fetched: true,
        viewings: [{ id: "456" }],
        listingsById: {},
      });
    });

    const { container, root } = renderHarness({
      entityId: "123",
      listIncludesTarget: viewingListIncludesId,
      fetchById,
    });

    await act(async () => {
      root.render(
        <DeepLinkHarness
          entityId="456"
          listIncludesTarget={viewingListIncludesId}
          fetchById={fetchById}
        />
      );
    });
    await flushPromises();

    deferred123.resolve({
      outcome: "resolved",
      fetched: true,
      viewings: [{ id: "123" }],
      listingsById: {},
    });
    await flushPromises();

    expect(container.querySelector('[data-testid="resolve-state"]').textContent).toBe("resolved");
    expect(container.querySelector('[data-testid="list-count"]').textContent).toBe("1");
    expect(fetchById.mock.calls.some((call) => String(call[0]?.entityId) === "456")).toBe(true);
    expect(fetchById.mock.calls.some((call) => String(call[0]?.entityId) === "123")).toBe(true);
  });

  test("maps fetch error to error resolve state", async () => {
    const fetchById = jest.fn(() =>
      Promise.resolve({
        outcome: "error",
        fetched: true,
        error: { message: "network failure" },
      })
    );

    const { container } = renderHarness({ entityId: "conv-1", fetchById });
    await flushPromises();

    expect(container.querySelector('[data-testid="resolve-state"]').textContent).toBe("error");
  });

  test("maps empty row to missing resolve state", async () => {
    const fetchById = jest.fn(() =>
      Promise.resolve({
        outcome: "missing",
        fetched: true,
        error: null,
      })
    );

    const { container } = renderHarness({ entityId: "conv-gone", fetchById });
    await flushPromises();

    expect(container.querySelector('[data-testid="resolve-state"]').textContent).toBe("missing");
  });
});
