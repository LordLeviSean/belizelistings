/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import UserListingRowIntel from "./UserListingRowIntel";

function renderIntel(listing) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<UserListingRowIntel listing={listing} />);
  });
  return container;
}

describe("UserListingRowIntel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("renders zero metrics instead of placeholders", () => {
    const container = renderIntel({ id: 1, updated_at: "2026-07-01T00:00:00Z" });
    expect(container.textContent).toMatch(/Views\s*0/);
    expect(container.textContent).toMatch(/Saves\s*0/);
    expect(container.textContent).toMatch(/Inquiries\s*0/);
  });

  test("renders live metric counts from listing row intel fields", () => {
    const container = renderIntel({
      id: 2,
      view_count: 12,
      favorite_count: 3,
      inquiry_count: 2,
      updated_at: "2026-07-01T00:00:00Z",
    });
    expect(container.textContent).toMatch(/Views\s*12/);
    expect(container.textContent).toMatch(/Saves\s*3/);
    expect(container.textContent).toMatch(/Inquiries\s*2/);
  });
});
