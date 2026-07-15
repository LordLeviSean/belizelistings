import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  BELIZE_MAP_REGION_CONFIG,
  BELIZE_MAP_REGION_ORDER,
} from "@/constants/belizeMapRegions";
import { getRegionByAny, getRegionCaption, normalizeRegionSlug } from "@/constants/geographyLayer";
import styles from "./BelizeMap.module.css";

const MAP_URL = "/maps/clean-mainland-districts.svg";

const TIP_PAD = 10;
const TIP_CURSOR_OFF = 21;
const TIP_EST_W = 200;
const TIP_EST_H = 30;
const FLY_MS = 640;

function tooltipPosition(clientX, clientY) {
  if (typeof window === "undefined") {
    return { left: clientX + TIP_CURSOR_OFF, top: clientY + TIP_CURSOR_OFF };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = clientX + TIP_CURSOR_OFF;
  let top = clientY + TIP_CURSOR_OFF;

  if (left + TIP_EST_W + TIP_PAD > vw) {
    left = clientX - TIP_EST_W - 8;
  }
  if (top + TIP_EST_H + TIP_PAD > vh) {
    top = clientY - TIP_EST_H - 8;
  }

  left = Math.min(Math.max(TIP_PAD, left), vw - TIP_EST_W - TIP_PAD);
  top = Math.min(Math.max(TIP_PAD, top), vh - TIP_EST_H - TIP_PAD);

  return { left, top };
}

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

  const mapContainerRef = useRef(null);
  const flyTimeoutRef = useRef(0);
  const mapReadyFiredRef = useRef(false);
  const [fetchedMarkup, setFetchedMarkup] = useState("");
  const [hoverTooltip, setHoverTooltip] = useState(null);
  const [clickedRegionId, setClickedRegionId] = useState(null);
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

  const fireMapReady = useCallback(() => {
    if (mapReadyFiredRef.current) return;
    mapReadyFiredRef.current = true;
    onMapReady?.();
  }, [onMapReady]);

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

    for (const regionId of BELIZE_MAP_REGION_ORDER) {
      const cfg = BELIZE_MAP_REGION_CONFIG[regionId];
      if (!cfg?.slug) continue;

      const group = svg.getElementById(regionId);
      if (!group) continue;
      interactiveGroups.push({ regionId, group });

      const subregion = activeSubregionSlug ? getRegionByAny(activeSubregionSlug) : null;
      const isSubregionOnThisRegion =
        subregion &&
        normalizeRegionSlug(subregion?.mapRegion) === normalizeRegionSlug(regionId) &&
        normalizeRegionSlug(cfg.slug) === normalizeRegionSlug(activeDistrictSlug);
      const label = isSubregionOnThisRegion ? `${subregion.label} · ${cfg.label}` : cfg.label;

      group.classList.add(styles.mapDistrictGroup);

      const onEnter = (e) => {
        if (clickedRegionRef.current) return;
        group.classList.add(styles.districtHover);
        interactiveGroups.forEach(({ regionId: otherId, group: otherGroup }) => {
          if (otherId !== regionId) {
            otherGroup.classList.add(styles.districtDimmed);
          }
        });

        // Restore focus isolation for the pre-selected district (district pages).
        if (activeRegionId) {
          interactiveGroups.forEach(({ regionId: otherId, group: otherGroup }) => {
            if (otherId === activeRegionId) {
              otherGroup.classList.add(styles.districtActive);
              otherGroup.classList.remove(styles.districtDimmed);
            }
          });
        }

        setHoverTooltip({ label, x: e.clientX, y: e.clientY });
      };

      const onMove = (e) => {
        setHoverTooltip((prev) =>
          prev && prev.label === label ? { ...prev, x: e.clientX, y: e.clientY } : prev
        );
      };

      const onLeave = () => {
        group.classList.remove(styles.districtHover);

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
        } else {
          interactiveGroups.forEach(({ group: otherGroup }) => {
            otherGroup.classList.remove(styles.districtDimmed);
          });
        }
        setHoverTooltip(null);
      };

      const onClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (clickedRegionRef.current) return;
        setClickedRegionId(regionId);
        setHoverTooltip(null);

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

      group.addEventListener("mouseenter", onEnter);
      group.addEventListener("mousemove", onMove);
      group.addEventListener("mouseleave", onLeave);
      group.addEventListener("click", onClick);

      disposers.push(() => {
        group.removeEventListener("mouseenter", onEnter);
        group.removeEventListener("mousemove", onMove);
        group.removeEventListener("mouseleave", onLeave);
        group.removeEventListener("click", onClick);
        group.classList.remove(styles.mapDistrictGroup);
        group.classList.remove(styles.districtHover);
        group.classList.remove(styles.districtDimmed);
        group.classList.remove(styles.districtClicked);
        group.classList.remove(styles.districtActive);
      });
    }

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
      setHoverTooltip(null);
      disposers.forEach((d) => d());
    };
  }, [svgMarkup, fireMapReady]);

  useEffect(() => {
    return () => {
      cancelFlyTimeout();
    };
  }, []);

  return (
    <div
      className={`${styles.map} ${styles.mapNoSelect} ${styles.mapFitLayout} ${
        variant === "districtHero" ? styles.mapDistrictHero : ""
      }`}
    >
      <div className={styles.mapStage}>
        {showAmbientVeil ? <div className={styles.mapAmbientVeil} aria-hidden /> : null}
        <div
          ref={mapContainerRef}
          className={styles.mapSvg}
          dangerouslySetInnerHTML={svgInnerHtml}
        />
        {/* Future: district badges, heat, pricing, pulses — absolute layer; keep pointer-events: none until interactive overlays ship */}
        <div className={styles.mapOverlays} aria-hidden="true" />
      </div>
      {hoverTooltip ? (
        <div
          className={styles.mapDistrictTooltip}
          style={{
            left: tooltipCoords.left,
            top: tooltipCoords.top,
          }}
          role="status"
        >
          {hoverTooltip.label}
        </div>
      ) : null}
    </div>
  );
};

export default React.memo(BelizeMap);
