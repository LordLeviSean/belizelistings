import Link from "next/link";
import styles from "./PremiumEmptyState.module.css";

/**
 * Premium empty-state shell — Caribbean calm gradients, guidance-first copy.
 * Use `variant` for defaults; override with title/description when needed.
 */
const VARIANT_DEFAULTS = {
  favorites: {
    title: "Saved listings",
    description: "Save listings you love — they’ll appear here.",
    accent: "✦",
  },
  search: {
    title: "No matches in this view",
    description: "Widen your search, try another district, or return to the map to discover more.",
    accent: "◇",
  },
  district: {
    title: "Nothing in this filter yet",
    description: "Try a nearby district or ease a filter — new listings arrive often.",
    accent: "◎",
  },
  listings: {
    title: "Start building your Belize inventory",
    description:
      "Your operational workspace is ready. Create a listing draft — it stays private until you submit for review.",
    accent: "◈",
  },
  drafts: {
    title: "Your draft workspace is ready",
    description:
      "Drafts stay private and autosave as you work. Start from Create listing whenever inspiration strikes.",
    accent: "✎",
  },
  archived: {
    title: "Nothing archived here yet",
    description:
      "Archived listings stay recoverable — when you retire inventory from public view, it appears here.",
    accent: "◌",
  },
  rejected: {
    title: "No rejected listings in this filter",
    description:
      "Corrections stay calm — if moderation asks for changes, you’ll see them here with clear next steps.",
    accent: "◆",
  },
  active: {
    title: "No active listings in this slice",
    description:
      "Publish approved inventory or restore archived listings when your operational capacity allows.",
    accent: "●",
  },
  inquiries: {
    title: "No inquiries yet — visibility builds leads",
    description:
      "Active listings attract engagement over time. Polish photos and descriptions to invite quality conversations.",
    accent: "✉",
  },
  activity: {
    title: "Your operational timeline is quiet",
    description:
      "As listings move through moderation and inventory health shifts, calm operational signals appear here.",
    accent: "≋",
  },
  broker: {
    title: "Link your brokerage to unlock team scope",
    description:
      "Once brokerage affiliation is on your profile, teammate inventory aggregates here for oversight.",
    accent: "⚙",
  },
  moderation: {
    title: "Nothing waiting in this queue",
    description:
      "When listings need governance attention, they surface here with lifecycle clarity — check back after new submissions.",
    accent: null,
  },
  generic: {
    title: "Nothing here yet",
    description: "This space updates as your BelizeListings ecosystem grows.",
    accent: "○",
  },
};

/** Admin / operator registry filters → consistent empty copy */
export function getPremiumEmptyForRegistryFilter(statusFilter) {
  switch (statusFilter) {
    case "pending":
      return { variant: "moderation" };
    case "rejected":
      return { variant: "rejected" };
    case "archived":
      return { variant: "archived" };
    case "approved":
      return {
        variant: "active",
        title: "No published listings in this filter",
        description:
          "Approved inventory appears here when it matches this slice — widen to All or check Pending Review.",
      };
    default:
      return {
        variant: "generic",
        title: "No listings in the registry for this filter",
        description:
          "As agents submit inventory, operational rows appear here for governance and continuity.",
      };
  }
}

export default function PremiumEmptyState({
  variant = "generic",
  title,
  description,
  accent,
  primary,
  secondary,
  compact = false,
  className = "",
}) {
  const preset = VARIANT_DEFAULTS[variant] || VARIANT_DEFAULTS.generic;
  const a = accent !== undefined ? accent : preset.accent;
  const t = title ?? preset.title;
  const d = description ?? preset.description;
  const showAccent = a != null && String(a).trim() !== "";

  return (
    <div
      className={`${styles.wrap} ${compact ? styles.compact : ""} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        {showAccent ? (
          <span className={styles.accent} aria-hidden>
            {a}
          </span>
        ) : null}
        <h2 className={styles.title}>{t}</h2>
        <p className={styles.desc}>{d}</p>
        {(primary || secondary) && (
          <div className={styles.actions}>
            {primary ? (
              primary.href ? (
                <Link href={primary.href} className={primary.className ?? styles.primary}>
                  {primary.label}
                </Link>
              ) : (
                <button type="button" className={primary.className ?? styles.primary} onClick={primary.onClick}>
                  {primary.label}
                </button>
              )
            ) : null}
            {secondary ? (
              secondary.href ? (
                <Link href={secondary.href} className={secondary.className ?? styles.secondary}>
                  {secondary.label}
                </Link>
              ) : (
                <button type="button" className={secondary.className ?? styles.secondary} onClick={secondary.onClick}>
                  {secondary.label}
                </button>
              )
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
