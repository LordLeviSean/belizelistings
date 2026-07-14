/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import GeographySelector from "./GeographySelector";
import { MAP_REGION_SELECTOR_ORDER } from "@/lib/geography/belizeGeographyV1";

function renderSelector(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const state = { value: props.value || {}, onChange: props.onChange || jest.fn() };
  const rerender = (nextProps = {}) => {
    act(() => {
      root.render(
        <GeographySelector
          value={state.value}
          onChange={(patch) => {
            state.value = { ...state.value, ...patch };
            state.onChange(patch);
            rerender(nextProps);
          }}
          errors={nextProps.errors || props.errors || {}}
          disabled={nextProps.disabled ?? props.disabled}
        />
      );
    });
  };
  act(() => {
    root.render(
      <GeographySelector
        value={state.value}
        onChange={(patch) => {
          state.value = { ...state.value, ...patch };
          state.onChange(patch);
          rerender();
        }}
        errors={props.errors || {}}
        disabled={props.disabled}
      />
    );
  });
  return { container, state, rerender };
}

describe("GeographySelector", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("renders native selects with approved region order", () => {
    const { container } = renderSelector({ value: {} });
    const regionSelect = container.querySelector("#geo-map-region");
    expect(regionSelect).not.toBeNull();
    expect(regionSelect.tagName).toBe("SELECT");
    const labels = Array.from(regionSelect.options)
      .slice(1)
      .map((o) => o.textContent);
    expect(labels[0]).toBe("Corozal District");
    expect(labels[1]).toBe("Orange Walk District");
    expect(labels[2]).toBe("Belize District");
    expect(labels[3]).toBe("Cayo District");
    expect(labels[4]).toBe("Stann Creek District");
    expect(labels[5]).toBe("Toledo District");
    expect(labels[6]).toBe("Ambergris Caye");
    expect(labels[7]).toBe("Caye Caulker");
    expect(MAP_REGION_SELECTOR_ORDER).toHaveLength(8);
  });

  test("selecting a region populates the visible value and enables area select", () => {
    const onChange = jest.fn();
    const { container } = renderSelector({ value: {}, onChange });
    const regionSelect = container.querySelector("#geo-map-region");
    act(() => {
      regionSelect.value = "cayo";
      regionSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        map_region_slug: "cayo",
        community_id: "",
        locality_id: "",
        highway_id: "",
      })
    );
  });

  test("changing region clears child selections", () => {
    const onChange = jest.fn();
    const { container } = renderSelector({
      value: {
        map_region_slug: "cayo",
        community_id: "area-cayo-san-ignacio",
        locality_id: "loc-cayo-san-ignacio-maya-vista",
      },
      onChange,
    });
    const regionSelect = container.querySelector("#geo-map-region");
    act(() => {
      regionSelect.value = "corozal";
      regionSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        map_region_slug: "corozal",
        community_id: "",
        locality_id: "",
        highway_id: "",
        highway_mile: "",
      })
    );
  });

  test("mile field hidden until highway selected", () => {
    const { container } = renderSelector({
      value: { map_region_slug: "cayo", community_id: "area-cayo-san-ignacio" },
    });
    expect(container.querySelector("#geo-mile")).toBeNull();
  });

  test("mile field shown for highway selection only", () => {
    const { container } = renderSelector({
      value: {
        map_region_slug: "stann-creek",
        highway_id: "highway-hummingbird-highway",
      },
    });
    expect(container.querySelector("#geo-mile")).not.toBeNull();
  });

  test("area select disabled until region chosen", () => {
    const { container } = renderSelector({ value: {} });
    const areaSelect = container.querySelector("#geo-area");
    expect(areaSelect.disabled).toBe(true);
  });

  test("select touch targets meet 44px minimum", () => {
    const { container } = renderSelector({ value: {} });
    const regionSelect = container.querySelector("#geo-map-region");
    const styles = window.getComputedStyle(regionSelect);
    expect(Number.parseFloat(styles.minHeight)).toBeGreaterThanOrEqual(44);
  });

  test("reopening and changing community updates controlled value", () => {
    const onChange = jest.fn();
    const { container, rerender } = renderSelector({
      value: {
        map_region_slug: "belize",
        community_id: "area-belize-belize-city",
      },
      onChange,
    });
    let areaSelect = container.querySelector("#geo-area");
    expect(areaSelect.value).toBe("area-belize-belize-city");
    act(() => {
      areaSelect.value = "road-john-smith-road";
      areaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        road_corridor_id: "road-john-smith-road",
        community_id: "",
        locality_id: "",
      })
    );
  });

  test("keyboard-focusable native select is not aria-hidden", () => {
    const { container } = renderSelector({ value: {} });
    const regionSelect = container.querySelector("#geo-map-region");
    expect(regionSelect.getAttribute("aria-hidden")).toBeNull();
    expect(regionSelect.tabIndex).not.toBe(-1);
  });
});
