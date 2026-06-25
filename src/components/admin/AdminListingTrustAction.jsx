import useUserRole from "../../hooks/useUserRole";
import {
  getListingVerificationAdminLabel,
  isListingCardVerified,
} from "../../utils/listingVerification";
import trustStyles from "../ListingTrustStrip.module.css";
import dashStyles from "../../styles/Dashboard.module.css";

/**
 * Admin-only listing verification control — reusable trust action slot pattern.
 * Modal + mutation orchestration live in AllListingsPanel (ArchiveListingModal pattern).
 */
export default function AdminListingTrustAction({
  listing,
  busy = false,
  onVerify,
  onRequestUnverify,
  layout = "inline",
}) {
  const { role } = useUserRole();

  const isVerified = isListingCardVerified(listing);
  const label = getListingVerificationAdminLabel(listing);

  if (role !== "admin") return null;

  const chipTone = isVerified ? trustStyles.verified : "";

  const handleClick = () => {
    if (busy) return;
    if (isVerified) {
      onRequestUnverify?.();
      return;
    }
    onVerify?.();
  };

  if (layout === "compact") {
    return (
      <>
        <span className={`${trustStyles.chip} ${chipTone}`}>{label}</span>
        <button
          type="button"
          className={isVerified ? dashStyles.rejectButton : dashStyles.approveButton}
          disabled={busy}
          onClick={handleClick}
        >
          {busy ? "Processing…" : isVerified ? "Remove Verification" : "Verify Listing"}
        </button>
      </>
    );
  }

  return (
    <div className={dashStyles.adminTrustAction}>
      <span className={`${trustStyles.chip} ${chipTone}`}>{label}</span>
      <button
        type="button"
        className={isVerified ? dashStyles.dashboardLink : dashStyles.approveButton}
        disabled={busy}
        onClick={handleClick}
      >
        {busy ? "Processing…" : isVerified ? "Remove Verification" : "Verify Listing"}
      </button>
    </div>
  );
}
