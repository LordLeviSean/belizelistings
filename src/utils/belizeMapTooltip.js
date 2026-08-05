import { getRegionByAny, normalizeRegionSlug } from "@/constants/geographyLayer";

export const TIP_PAD = 10;
export const TIP_CURSOR_OFF = 21;
export const TIP_EST_W = 200;
export const TIP_EST_H = 30;

/** Viewport-clamped follow-cursor / focus anchor for the map district tooltip. */
export function tooltipPosition(clientX, clientY, viewport = null) {
  const vw = viewport?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  const vh = viewport?.height ?? (typeof window !== "undefined" ? window.innerHeight : 900);

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

/** Label shown in the map tooltip — uses canonical geography names only. */
export function resolveMapRegionLabel({
  regionId,
  regionLabel,
  activeDistrictSlug = null,
  activeSubregionSlug = null,
  regionSlug = null,
}) {
  const subregion = activeSubregionSlug ? getRegionByAny(activeSubregionSlug) : null;
  const isSubregionOnThisRegion =
    subregion &&
    normalizeRegionSlug(subregion?.mapRegion) === normalizeRegionSlug(regionId) &&
    normalizeRegionSlug(regionSlug) === normalizeRegionSlug(activeDistrictSlug);

  return isSubregionOnThisRegion ? `${subregion.label} · ${regionLabel}` : regionLabel;
}

/** Screen coordinates for a region group's visual center (keyboard focus anchor). */
export function regionCenterClient(group, svg) {
  if (!group || !svg?.createSVGPoint) return null;
  try {
    const bbox = group.getBBox();
    const pt = svg.createSVGPoint();
    pt.x = bbox.x + bbox.width / 2;
    pt.y = bbox.y + bbox.height / 2;
    const ctm = group.getScreenCTM();
    if (!ctm) return null;
    const sp = pt.matrixTransform(ctm);
    return { x: sp.x, y: sp.y };
  } catch {
    return null;
  }
}
