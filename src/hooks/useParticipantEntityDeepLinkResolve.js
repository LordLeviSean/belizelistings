import { useEffect, useRef, useState } from "react";
import { mapParticipantDeepLinkResultToState } from "@/lib/crm/participantDeepLinkOutcome";

/**
 * Race-safe deep-link entity resolution for dashboard surfaces.
 *
 * - List snapshots are read from refs so generic list mutations do not cancel in-flight fetches.
 * - A monotonic request id ignores stale responses when the target entity changes (123 → 456).
 *
 * @param {{
 *   enabled?: boolean,
 *   participantUserId?: string|null,
 *   entityId?: string|number|null,
 *   listLoading?: boolean,
 *   listIncludesTarget: (list: Array<object>, targetId: string|number) => boolean,
 *   getListSnapshot: () => Array<object>,
 *   getListingsByIdSnapshot?: () => Record<string|number, object>,
 *   fetchById: (input: {
 *     participantUserId: string,
 *     entityId: string|number,
 *     list: Array<object>,
 *     listingsById: Record<string|number, object>,
 *   }) => Promise<{ outcome?: string, resolved?: boolean, fetched?: boolean, [key: string]: unknown }>,
 *   onFetched?: (result: object) => void,
 * }} options
 * @returns {import("@/lib/crm/participantDeepLinkOutcome").DeepLinkResolveState}
 */
export function useParticipantEntityDeepLinkResolve({
  enabled = true,
  participantUserId = null,
  entityId = null,
  listLoading = false,
  listIncludesTarget,
  getListSnapshot,
  getListingsByIdSnapshot = () => ({}),
  fetchById,
  onFetched,
}) {
  const [resolveState, setResolveState] = useState("idle");
  const requestRef = useRef(0);
  const listRef = useRef([]);
  const listingsRef = useRef({});

  listRef.current = getListSnapshot() ?? [];
  listingsRef.current = getListingsByIdSnapshot() ?? {};

  useEffect(() => {
    if (!enabled || !participantUserId || entityId == null || entityId === "") {
      setResolveState("idle");
      return undefined;
    }

    const requestId = ++requestRef.current;

    if (listIncludesTarget(listRef.current, entityId)) {
      setResolveState("resolved");
      return undefined;
    }

    if (listLoading) {
      setResolveState("loading");
      return undefined;
    }

    setResolveState("loading");

    void (async () => {
      const result = await fetchById({
        participantUserId,
        entityId,
        list: listRef.current,
        listingsById: listingsRef.current,
      });

      if (requestId !== requestRef.current) {
        return;
      }

      const nextState = mapParticipantDeepLinkResultToState(result);
      if (result?.outcome === "resolved" && result?.fetched && onFetched) {
        onFetched(result);
      }
      setResolveState(nextState);
    })();

    return undefined;
  }, [
    enabled,
    participantUserId,
    entityId,
    listLoading,
    listIncludesTarget,
    fetchById,
    onFetched,
  ]);

  return resolveState;
}
