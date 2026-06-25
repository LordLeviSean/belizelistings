import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { fetchListingTimeline } from "@/lib/listingEvents/fetchListingTimeline";
import { presentListingEvent } from "@/lib/listingEvents/listingEventPresentation";
import { LISTING_EVENT_TYPES } from "@/lib/listingEvents/listingEventTypes";
import styles from "./ListingTimelinePanel.module.css";

const EMPTY_MESSAGE =
  "This property was recently published. Additional history will appear here as this listing evolves.";

function sessionKey(listingId) {
  return `bl_listing_timeline_expanded_${listingId}`;
}

function readExpandedFromSession(listingId) {
  if (typeof sessionStorage === "undefined" || !listingId) return false;
  try {
    return sessionStorage.getItem(sessionKey(listingId)) === "1";
  } catch {
    return false;
  }
}

function writeExpandedToSession(listingId, expanded) {
  if (typeof sessionStorage === "undefined" || !listingId) return;
  try {
    if (expanded) {
      sessionStorage.setItem(sessionKey(listingId), "1");
    } else {
      sessionStorage.removeItem(sessionKey(listingId));
    }
  } catch {
    /* ignore */
  }
}

export default function ListingTimelinePanel({ listingId }) {
  const panelId = useId();
  const id = String(listingId || "").trim();
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fetchStartedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    setExpanded(readExpandedFromSession(id));
    setEvents([]);
    setLoaded(false);
    fetchStartedRef.current = false;
  }, [id]);

  const loadTimeline = useCallback(async () => {
    if (!id || fetchStartedRef.current) return;
    fetchStartedRef.current = true;
    setLoading(true);
    try {
      const { events: rows } = await fetchListingTimeline(id);
      setEvents(Array.isArray(rows) ? rows : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    if (!expanded || !id) return;
    void loadTimeline();
  }, [expanded, id, loadTimeline]);

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      writeExpandedToSession(id, next);
      return next;
    });
  };

  if (!id) return null;

  const showEmpty = loaded && !loading && events.length === 0;

  return (
    <section className={styles.wrap} aria-label="Property history">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={toggleExpanded}
      >
        <h2 className={styles.title}>Property History</h2>
        <ChevronDown
          size={16}
          strokeWidth={2.25}
          aria-hidden
          className={`${styles.chevron} ${expanded ? styles.chevronExpanded : ""}`}
        />
      </button>

      <div
        id={panelId}
        className={`${styles.body} ${expanded ? styles.bodyExpanded : ""}`}
        aria-hidden={!expanded}
      >
        <div className={styles.bodyInner}>
          <div className={styles.content}>
            {loading ? <p className={styles.loading}>Loading history…</p> : null}

            {showEmpty ? <p className={styles.empty}>{EMPTY_MESSAGE}</p> : null}

            {!loading && events.length > 0 ? (
              <ol className={styles.list}>
                {events.map((event) => {
                  const presentation = presentListingEvent(event);
                  const Icon = presentation.icon;
                  const isVerified =
                    event.event_type === LISTING_EVENT_TYPES.VERIFICATION_APPROVED;

                  return (
                    <li key={event.id} className={styles.row}>
                      <span
                        className={`${styles.iconWrap} ${isVerified ? styles.iconWrapVerified : ""}`}
                        aria-hidden
                      >
                        <Icon size={14} strokeWidth={2.25} />
                      </span>
                      <div className={styles.rowMain}>
                        <p className={styles.headline}>{presentation.headline}</p>
                        {presentation.relativeTime ? (
                          <p className={styles.meta}>{presentation.relativeTime}</p>
                        ) : null}
                        {presentation.description ? (
                          <p className={styles.description}>{presentation.description}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
