import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import {
  BELIZE_MAP_REGION_CONFIG,
  BELIZE_MAP_REGION_ORDER,
} from "@/constants/belizeMapRegions";
import { getRegionCaption } from "@/constants/geographyLayer";
import {
  regionCenterClient,
  resolveMapRegionLabel,
  tooltipPosition,
} from "@/utils/belizeMapTooltip";
import styles from "./BelizeMap.module.css";

const MAP_URL = "/maps/clean-mainland-districts.svg";
const FLY_MS = 640;
const TOUCH_LABEL_CLEAR_MS = 320;

/**
 * Map-first discovery: hover for preview, click navigates to district browsing.
 * Optional `districtListingCounts` reserved for future overlay layers.
 */
const BelizeMap = ({
  districtListingCounts = null,
  variant = null,
  activeDistrictSlug = null,
  activeSubregionSlug = null,
  onDistrictClick = null,
  onMapReady = null,
  showAmbientVeil = true,
}) => {
  void districtListingCounts;

  const router = useRouter();
  const routerRef = useRef(router);

  const mapStageRef = useRef(null);
  const mapContainerRef = useRef(null);
  const flyTimeoutRef = useRef(0);
  const mapReadyFiredRef = useRef(false);
  const touchLabelTimerRef = useRef(0);
  const [fetchedMarkup, setFetchedMarkup] = useState("");
  const [hoverTooltip, setHoverTooltip] = useState(null);
  const [clickedRegionId, setClickedRegionId] = useState(null);
  const [tooltipHost, setTooltipHost] = useState(null);
  const clickedRegionRef = useRef(null);
  const svgMarkup = fetchedMarkup;

  const svgInnerHtml = useMemo(() => {
    if (!svgMarkup) return undefined;
    return { __html: svgMarkup };
  }, [svgMarkup]);

  const tooltipCoords = hoverTooltip
    ? tooltipPosition(hoverTooltip.x, hoverTooltip.y)
    : { left: 0, top: 0 };

  const cancelFlyTimeout = () => {
    if (flyTimeoutRef.current) {
      window.clearTimeout(flyTimeoutRef.current);
      flyTimeoutRef.current = 0;
    }
  };

  const cancelTouchLabelTimer = () => {
    if (touchLabelTimerRef.current) {
      window.clearTimeout(touchLabelTimerRef.current);
      touchLabelTimerRef.current = 0;
    }
  };

  const clearHoverTooltip = () => {
    cancelTouchLabelTimer();
    setHoverTooltip(null);
  };

  const fireMapReady = useCallback(() => {
    if (mapReadyFiredRef.current) return;
    mapReadyFiredRef.current = true;
    onMapReady?.();
  }, [onMapReady]);

  useEffect(() => {
    setTooltipHost(typeof document !== "undefined" ? document.body : null);
  }, []);

  useEffect(() => {
    if (!onMapReady) return undefined;
    const fallback = window.setTimeout(fireMapReady, 1800);
    return () => window.clearTimeout(fallback);
  }, [onMapReady, fireMapReady]);

  useEffect(() => {
    let isMounted = true;

    const loadMap = async () => {
      try {
        const response = await fetch(MAP_URL);
        if (!response.ok) return;
        const svgText = await response.text();
        if (isMounted) setFetchedMarkup(svgText);
      } catch {
        // Asset missing or network error — map stays empty.
      }
    };

    loadMap();
    return () => {
      isMounted = false;
    };
  }, []);

  useLayoutEffect(() => {
    routerRef.current = router;
  }, [router]);

  useLayoutEffect(() => {
    clickedRegionRef.current = clickedRegionId;
  }, [clickedRegionId]);

  useLayoutEffect(() => {
    if (!svgMarkup) return;

    const container = mapContainerRef.current;
    const stage = mapStageRef.current;
    const svg = container?.querySelector("svg");
    if (!svg) return;

    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const interactiveGroups = [];
    const disposers = [];

    let activeRegionId = null;
    if (activeDistrictSlug) {
      for (const regionId of BELIZE_MAP_REGION_ORDER) {
        const cfg = BELIZE_MAP_REGION_CONFIG[regionId];
        if (cfg?.slug === activeDistrictSlug) {
          activeRegionId = regionId;
          break;
        }
      }
    }

    // Hover dim is desktop-only — on touch, mouseenter forces class churn while scrolling.
    const supportsHover =
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches);

    const applyHoverVisuals = (regionId) => {
      interactiveGroups.forEach(({ regionId: otherId, group: otherGroup }) => {
        if (otherId === regionId) {
          otherGroup.classList.add(styles.districtHover);
          otherGroup.classList.remove(styles.districtDimmed);
        } else {
          otherGroup.classList.remove(styles.districtHover);
          otherGroup.classList.add(styles.districtDimmed);
        }
      });

      if (activeRegionId) {
        interactiveGroups.forEach(({ regionId: otherId, group: otherGroup }) => {
          if (otherId === activeRegionId) {
            otherGroup.classList.add(styles.districtActive);
            otherGroup.classList.remove(styles.districtDimmed);
          }
        });
      }
    };

    const clearHoverVisuals = () => {
      if (activeRegionId) {
        interactiveGroups.forEach(({ regionId: otherId, group: otherGroup }) => {
          if (otherId === activeRegionId) {
            otherGroup.classList.add(styles.districtActive);
            otherGroup.classList.remove(styles.districtDimmed);
            otherGroup.classList.remove(styles.districtHover);
          } else {
            otherGroup.classList.remove(styles.districtActive);
            otherGroup.classList.remove(styles.districtHover);
            otherGroup.classList.add(styles.districtDimmed);
          }
        });
      } else {
        interactiveGroups.forEach(({ group: otherGroup }) => {
          otherGroup.classList.remove(styles.districtHover);
          otherGroup.classList.remove(styles.districtDimmed);
        });
      }
    };

    const showTooltipAt = (label, x, y) => {
      cancelTouchLabelTimer();
      setHoverTooltip({ label, x, y });
    };

    const showTooltipForGroup = (group, label) => {
      const center = regionCenterClient(group, svg);
      if (center) {
        showTooltipAt(label, center.x, center.y);
      }
    };

    for (const regionId of BELIZE_MAP_REGION_ORDER) {
      const cfg = BELIZE_MAP_REGION_CONFIG[regionId];
      if (!cfg?.slug) continue;

      const group = svg.getElementById(regionId);
      if (!group) continue;
      interactiveGroups.push({ regionId, group });

      const label = resolveMapRegionLabel({
        regionId,
        regionLabel: cfg.label,
        activeDistrictSlug,
        activeSubregionSlug,
        regionSlug: cfg.slug,
      });

      group.classList.add(styles.mapDistrictGroup);
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      group.setAttribute("aria-label", label);

      const onEnter = (e) => {
        if (clickedRegionRef.current) return;
        applyHoverVisuals(regionId);
        showTooltipAt(label, e.clientX, e.clientY);
      };

      const onMove = (e) => {
        setHoverTooltip((prev) =>
          prev && prev.label === label ? { ...prev, x: e.clientX, y: e.clientY } : prev
        );
      };

      const onLeave = () => {
        clearHoverVisuals();
        clearHoverTooltip();
      };

      const onFocus = () => {
        if (clickedRegionRef.current) return;
        applyHoverVisuals(regionId);
        showTooltipForGroup(group, label);
      };

      const onBlur = () => {
        clearHoverVisuals();
        clearHoverTooltip();
      };

      const onKeyDown = (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        group.click();
      };

      const onTouchPointerDown = (e) => {
        if (e.pointerType === "mouse") return;
        if (clickedRegionRef.current) return;
        showTooltipAt(label, e.clientX, e.clientY);
      };

      const onTouchPointerEnter = (e) => {
        if (e.pointerType === "mouse") return;
        if (clickedRegionRef.current) return;
        if (e.buttons !== 0) {
          showTooltipAt(label, e.clientX, e.clientY);
        }
      };

      const onTouchPointerUp = (e) => {
        if (e.pointerType === "mouse") return;
        cancelTouchLabelTimer();
        touchLabelTimerRef.current = window.setTimeout(() => {
          if (!clickedRegionRef.current) {
            clearHoverTooltip();
          }
        }, TOUCH_LABEL_CLEAR_MS);
      };

      const onClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (clickedRegionRef.current) return;
        setClickedRegionId(regionId);
        clearHoverTooltip();

        interactiveGroups.forEach(({ regionId: otherId, group: otherGroup }) => {
          otherGroup.classList.remove(styles.districtHover);
          otherGroup.classList.remove(styles.districtActive);
          if (otherId === regionId) {
            otherGroup.classList.add(styles.districtClicked);
            otherGroup.classList.remove(styles.districtDimmed);
          } else {
            otherGroup.classList.remove(styles.districtClicked);
            otherGroup.classList.add(styles.districtDimmed);
          }
        });

        cancelFlyTimeout();
        flyTimeoutRef.current = window.setTimeout(() => {
          const payload = {
            regionId,
            slug: cfg.slug,
            label: cfg.label,
            caption: getRegionCaption(cfg.slug),
          };
          if (onDistrictClick) {
            onDistrictClick(cfg.slug, payload);
            return;
          }
          void routerRef.current.push(`/listings/district/${cfg.slug}`);
        }, FLY_MS);
      };

      if (supportsHover) {
        group.addEventListener("mouseenter", onEnter);
        group.addEventListener("mousemove", onMove);
        group.addEventListener("mouseleave", onLeave);
      } else {
        group.addEventListener("pointerdown", onTouchPointerDown);
        group.addEventListener("pointerenter", onTouchPointerEnter);
        group.addEventListener("pointerup", onTouchPointerUp);
        group.addEventListener("pointercancel", onTouchPointerUp);
      }

      group.addEventListener("focus", onFocus);
      group.addEventListener("blur", onBlur);
      group.addEventListener("keydown", onKeyDown);
      group.addEventListener("click", onClick);

      disposers.push(() => {
        if (supportsHover) {
          group.removeEventListener("mouseenter", onEnter);
          group.removeEventListener("mousemove", onMove);
          group.removeEventListener("mouseleave", onLeave);
        } else {
          group.removeEventListener("pointerdown", onTouchPointerDown);
          group.removeEventListener("pointerenter", onTouchPointerEnter);
          group.removeEventListener("pointerup", onTouchPointerUp);
          group.removeEventListener("pointercancel", onTouchPointerUp);
        }
        group.removeEventListener("focus", onFocus);
        group.removeEventListener("blur", onBlur);
        group.removeEventListener("keydown", onKeyDown);
        group.removeEventListener("click", onClick);
        group.removeAttribute("tabindex");
        group.removeAttribute("role");
        group.removeAttribute("aria-label");
        group.classList.remove(styles.mapDistrictGroup);
        group.classList.remove(styles.districtHover);
        group.classList.remove(styles.districtDimmed);
        group.classList.remove(styles.districtClicked);
        group.classList.remove(styles.districtActive);
      });
    }

    const onStagePointerLeave = () => {
      if (!supportsHover) {
        clearHoverTooltip();
      }
    };

    const onDocumentPointerDown = (e) => {
      if (!stage?.contains(e.target)) {
        clearHoverTooltip();
        if (document.activeElement instanceof SVGElement && stage && !stage.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      }
    };

    stage?.addEventListener("pointerleave", onStagePointerLeave);
    document.addEventListener("pointerdown", onDocumentPointerDown, true);

    // Initial active district focus (district pages).
    if (activeRegionId) {
      interactiveGroups.forEach(({ regionId: otherId, group: otherGroup }) => {
        if (otherId === activeRegionId) {
          otherGroup.classList.add(styles.districtActive);
          otherGroup.classList.remove(styles.districtDimmed);
        } else {
          otherGroup.classList.remove(styles.districtActive);
          otherGroup.classList.add(styles.districtDimmed);
        }
      });
    }

    fireMapReady();

    return () => {
      cancelFlyTimeout();
      cancelTouchLabelTimer();
      clearHoverTooltip();
      stage?.removeEventListener("pointerleave", onStagePointerLeave);
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      disposers.forEach((d) => d());
    };
  }, [svgMarkup, fireMapReady, activeDistrictSlug, activeSubregionSlug]);

  useEffect(() => {
    return () => {
      cancelFlyTimeout();
      cancelTouchLabelTimer();
    };
  }, []);

  const tooltipNode =
    hoverTooltip && tooltipHost ? (
      <div
        className={styles.mapDistrictTooltip}
        style={{
          left: tooltipCoords.left,
          top: tooltipCoords.top,
        }}
        role="status"
        aria-live="polite"
      >
        {hoverTooltip.label}
      </div>
    ) : null;

  return (
    <div
      className={`${styles.map} ${styles.mapNoSelect} ${styles.mapFitLayout} ${
        variant === "districtHero" ? styles.mapDistrictHero : ""
      }`}
    >
      <div className={styles.mapStage} ref={mapStageRef}>
        {showAmbientVeil ? <div className={styles.mapAmbientVeil} aria-hidden /> : null}
        <div
          ref={mapContainerRef}
          className={styles.mapSvg}
          dangerouslySetInnerHTML={svgInnerHtml}
        />
        {/* Future: district badges, heat, pricing, pulses — absolute layer; keep pointer-events: none until interactive overlays ship */}
        <div className={styles.mapOverlays} aria-hidden="true" />
      </div>
      {tooltipHost && tooltipNode ? createPortal(tooltipNode, tooltipHost) : null}
    </div>
  );
};

export default React.memo(BelizeMap);
