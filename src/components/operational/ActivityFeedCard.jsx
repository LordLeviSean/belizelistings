import opStyles from "./OperationalIntel.module.css";

const ICON = {
  rejected: "✎",
  pending: "◷",
  approved: "✓",
  archived: "⌂",
  draft: "◌",
  health: "!",
};

export default function ActivityFeedCard({ headline, detail, tone = "approved", timeLabel, onOpen }) {
  const ic = ICON[tone] || ICON.approved;
  const toneClass =
    tone === "rejected"
      ? opStyles.toneRejected
      : tone === "pending"
        ? opStyles.tonePending
        : tone === "archived"
          ? opStyles.toneArchived
          : tone === "draft"
            ? opStyles.toneDraft
            : tone === "health"
              ? opStyles.toneHealth
              : opStyles.toneApproved;

  const inner = (
    <>
      <span className={opStyles.activityIcon} aria-hidden>
        {ic}
      </span>
      <div className={opStyles.activityBody}>
        <p className={opStyles.activityHeadline}>{headline}</p>
        <p className={opStyles.activityDetail}>{detail}</p>
        {timeLabel ? <p className={opStyles.activityTime}>{timeLabel}</p> : null}
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        className={`${opStyles.activityCard} ${toneClass}`}
        onClick={onOpen}
        style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={`${opStyles.activityCard} ${toneClass}`} role="presentation">
      {inner}
    </div>
  );
}
