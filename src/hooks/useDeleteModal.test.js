/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useDeleteModal } from "./useDeleteModal";
import { MODAL_TYPES, useModalController } from "./useModalController";

function renderDeleteModalHook() {
  const result = { current: null };
  function Harness() {
    result.current = useDeleteModal();
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness />);
  });
  const rerender = () =>
    act(() => {
      root.render(<Harness />);
    });
  return { result, rerender };
}

describe("useDeleteModal", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("starts closed with no target", () => {
    const { result } = renderDeleteModalHook();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.target).toBeNull();
  });

  test("openDelete sets target and opens modal", () => {
    const { result, rerender } = renderDeleteModalHook();
    act(() => {
      result.current.openDelete({ id: "42", title: "Test home" });
    });
    rerender();
    expect(result.current.isOpen).toBe(true);
    expect(result.current.target).toEqual({ id: "42", title: "Test home" });
  });

  test("closeDelete clears state", () => {
    const { result, rerender } = renderDeleteModalHook();
    act(() => {
      result.current.openDelete({ id: "1" });
    });
    rerender();
    act(() => {
      result.current.closeDelete();
    });
    rerender();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.target).toBeNull();
  });

  test("onBeforeOpen runs before opening", () => {
    const { result, rerender } = renderDeleteModalHook();
    const before = jest.fn();
    act(() => {
      result.current.openDelete({ id: "9" }, { onBeforeOpen: before });
    });
    rerender();
    expect(before).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(true);
  });

  test("openDelete closes other modals via controller before opening", () => {
    const controllerResult = { current: null };
    const deleteResult = { current: null };
    function Harness() {
      controllerResult.current = useModalController();
      deleteResult.current = useDeleteModal(controllerResult.current);
      return null;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Harness />);
    });
    const rerender = () =>
      act(() => {
        root.render(<Harness />);
      });

    act(() => {
      controllerResult.current.openModal(MODAL_TYPES.ARCHIVE, { listingId: "1" });
    });
    rerender();
    act(() => {
      deleteResult.current.openDelete({ id: "42", title: "Test home" });
    });
    rerender();
    expect(controllerResult.current.isModalOpen(MODAL_TYPES.ARCHIVE)).toBe(false);
    expect(deleteResult.current.isOpen).toBe(true);
    expect(deleteResult.current.target).toEqual({ id: "42", title: "Test home" });
  });
});
