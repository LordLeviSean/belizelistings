/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import DeleteConfirmationModal from "./DeleteConfirmationModal";

function renderModal(ui) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

describe("DeleteConfirmationModal", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("renders nothing when closed", () => {
    const { container } = renderModal(
      <DeleteConfirmationModal isOpen={false} onClose={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  test("renders dialog when open", () => {
    const { container } = renderModal(
      <DeleteConfirmationModal
        isOpen
        title="Delete Listing?"
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain("Delete Listing?");
    expect(container.textContent).toContain("This action cannot be undone.");
  });

  test("does not call onConfirm on mount", () => {
    const onConfirm = jest.fn();
    renderModal(
      <DeleteConfirmationModal isOpen onClose={jest.fn()} onConfirm={onConfirm} />
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("cancel calls onClose", () => {
    const onClose = jest.fn();
    const { container } = renderModal(
      <DeleteConfirmationModal isOpen onClose={onClose} onConfirm={jest.fn()} />
    );
    const cancel = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Cancel"
    );
    act(() => {
      cancel.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("confirm calls onConfirm when type-delete not required", () => {
    const onConfirm = jest.fn();
    const { container } = renderModal(
      <DeleteConfirmationModal isOpen onClose={jest.fn()} onConfirm={onConfirm} />
    );
    const confirm = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Delete"
    );
    act(() => {
      confirm.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("confirm blocked until delete typed when requireTypeDelete", () => {
    const onConfirm = jest.fn();
    const { container } = renderModal(
      <DeleteConfirmationModal
        isOpen
        requireTypeDelete
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />
    );
    const confirm = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Delete"
    );
    expect(confirm.disabled).toBe(true);
    const input = container.querySelector("input");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;
      setter.call(input, "delete");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const confirmEnabled = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Delete"
    );
    act(() => {
      confirmEnabled.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
