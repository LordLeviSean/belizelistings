/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MODAL_TYPES, useModalController } from "./useModalController";

function renderModalControllerHook() {
  const result = { current: null };
  function Harness() {
    result.current = useModalController();
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

describe("useModalController", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("starts with no active modal", () => {
    const { result } = renderModalControllerHook();
    expect(result.current.getActiveModal()).toBeNull();
    expect(result.current.isModalOpen(MODAL_TYPES.DELETE)).toBe(false);
  });

  test("openModal sets a single active modal", () => {
    const { result, rerender } = renderModalControllerHook();
    act(() => {
      result.current.openModal(MODAL_TYPES.DELETE, { id: "1" });
    });
    rerender();
    expect(result.current.isModalOpen(MODAL_TYPES.DELETE)).toBe(true);
    expect(result.current.getActiveModal()).toEqual({
      type: MODAL_TYPES.DELETE,
      payload: { id: "1" },
    });
  });

  test("opening a new modal replaces the previous one", () => {
    const { result, rerender } = renderModalControllerHook();
    act(() => {
      result.current.openModal(MODAL_TYPES.DELETE, { id: "1" });
    });
    rerender();
    act(() => {
      result.current.openModal(MODAL_TYPES.ARCHIVE, { listingId: "2" });
    });
    rerender();
    expect(result.current.isModalOpen(MODAL_TYPES.DELETE)).toBe(false);
    expect(result.current.isModalOpen(MODAL_TYPES.ARCHIVE)).toBe(true);
    expect(result.current.getActiveModal()?.payload).toEqual({ listingId: "2" });
  });

  test("closeAllModals clears active modal before open", () => {
    const { result, rerender } = renderModalControllerHook();
    act(() => {
      result.current.openModal(MODAL_TYPES.EDIT, { listingId: "9" });
    });
    rerender();
    act(() => {
      result.current.closeAllModals();
      result.current.openModal(MODAL_TYPES.DELETE, { id: "9" });
    });
    rerender();
    expect(result.current.isModalOpen(MODAL_TYPES.EDIT)).toBe(false);
    expect(result.current.isModalOpen(MODAL_TYPES.DELETE)).toBe(true);
  });

  test("closeModal closes specific type only", () => {
    const { result, rerender } = renderModalControllerHook();
    act(() => {
      result.current.openModal(MODAL_TYPES.DELETE, { id: "1" });
    });
    rerender();
    act(() => {
      result.current.closeModal(MODAL_TYPES.ARCHIVE);
    });
    rerender();
    expect(result.current.isModalOpen(MODAL_TYPES.DELETE)).toBe(true);
    act(() => {
      result.current.closeModal(MODAL_TYPES.DELETE);
    });
    rerender();
    expect(result.current.getActiveModal()).toBeNull();
  });
});
