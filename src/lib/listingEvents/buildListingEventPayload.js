import { OWNERSHIP_ACTIONS } from "../../constants/ownershipModel";
import { VERIFICATION_STATUS } from "../../constants/trustModel";
import {
  LISTING_EVENT_SOURCES,
  LISTING_EVENT_TYPES,
  getListingEventVisibility,
} from "./listingEventTypes";

export function buildVerificationApprovedPayload({ verifiedAt, verifiedBy, adminUserId }) {
  return {
    verification_status: VERIFICATION_STATUS.VERIFIED,
    verified_at: verifiedAt || new Date().toISOString(),
    verified_by: verifiedBy || adminUserId,
  };
}

export function buildVerificationRemovedPayload({
  previousVerifiedAt,
  previousVerifiedBy,
}) {
  return {
    verification_status: VERIFICATION_STATUS.UNVERIFIED,
    previous_verified_at: previousVerifiedAt ?? null,
    previous_verified_by: previousVerifiedBy ?? null,
  };
}

export function buildStatusChangedPayload({ fromStatus, toStatus, action }) {
  const payload = {};
  if (fromStatus) payload.from_status = fromStatus;
  if (toStatus) payload.to_status = toStatus;
  if (action) payload.action = action;
  return payload;
}

export function buildPriceChangePayload({ fromPrice, toPrice, currency }) {
  const from = Number(fromPrice);
  const to = Number(toPrice);
  const payload = {
    from: { price: from, currency: currency || "USD" },
    to: { price: to, currency: currency || "USD" },
  };
  if (Number.isFinite(from) && from > 0 && Number.isFinite(to)) {
    payload.delta_pct = Number((((to - from) / from) * 100).toFixed(2));
  }
  return payload;
}

/**
 * Map lifecycle moderation action → event descriptor for writeListingEvent.
 * @returns {{ eventType: string, visibility?: string, payload: object, source?: string } | null}
 */
export function lifecycleActionToEventDescriptor(action, { fromStatus, toStatus } = {}) {
  const payload = buildStatusChangedPayload({ fromStatus, toStatus, action });

  switch (action) {
    case OWNERSHIP_ACTIONS.APPROVE:
      return {
        eventType: LISTING_EVENT_TYPES.PUBLISHED,
        payload: { ...payload, lifecycle_status: toStatus || "approved" },
        source: LISTING_EVENT_SOURCES.ADMIN,
      };
    case OWNERSHIP_ACTIONS.REJECT:
      return {
        eventType: LISTING_EVENT_TYPES.MODERATION_REJECTED,
        payload,
        source: LISTING_EVENT_SOURCES.ADMIN,
      };
    case OWNERSHIP_ACTIONS.ARCHIVE:
      return {
        eventType: LISTING_EVENT_TYPES.ARCHIVED,
        payload,
        source: LISTING_EVENT_SOURCES.APP,
      };
    case OWNERSHIP_ACTIONS.REPUBLISH:
    case OWNERSHIP_ACTIONS.RESUBMIT:
      return {
        eventType: LISTING_EVENT_TYPES.REPUBLISHED,
        payload,
        source: LISTING_EVENT_SOURCES.APP,
      };
    case OWNERSHIP_ACTIONS.CLOSE_SOLD:
      return {
        eventType: LISTING_EVENT_TYPES.SOLD,
        payload,
        source: LISTING_EVENT_SOURCES.APP,
      };
    case OWNERSHIP_ACTIONS.CLOSE_RENTED:
      return {
        eventType: LISTING_EVENT_TYPES.RENTED,
        payload,
        source: LISTING_EVENT_SOURCES.APP,
      };
    default:
      return null;
  }
}

export function resolveEventWriteParams({
  eventType,
  payload = {},
  visibility,
  source = LISTING_EVENT_SOURCES.APP,
}) {
  return {
    eventType,
    payload,
    visibility: visibility || getListingEventVisibility(eventType),
    source,
  };
}
