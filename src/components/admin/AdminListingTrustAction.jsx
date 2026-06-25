import { useState } from "react";
import useUserRole from "../../hooks/useUserRole";
import { useToast } from "../ui/ToastProvider";
import {
  getListingVerificationAdminLabel,
  isListingCardVerified,
} from "../../utils/listingVerification";
import { applyListingVerificationAction } from "../../lib/listingVerificationMutations";
import { supabase } from "../../lib/supabaseClient";
import AdminListingActionConfirmModal from "./AdminListingActionConfirmModal";
import trustStyles from "../ListingTrustStrip.module.css";
import dashStyles from "../../styles/Dashboard.module.css";

/**
 * Admin-only listing verification control — reusable trust action slot pattern.
 * Reads/writes listing.verification_status only; does not touch other fields.
 */
export default function AdminListingTrustAction({
  listing,
  busy = false,
  onBusyChange,
  onUpdated,
  onAction,
  layout = "inline",
}) {
  const { user, role } = useUserRole();
  const { showToast } = useToast();
  const [confirmMode, setConfirmMode] = useState(null);
  const [localBusy, setLocalBusy] = useState(false);

  if (role !== "admin") return null;

  const listingId = String(listing?.id || "");
  const isVerified = isListingCardVerified(listing);
  const label = getListingVerificationAdminLabel(listing);
  const isBusy = busy || localBusy;

  const setBusy = (next) => {
    setLocalBusy(next);
    onBusyChange?.(next);
  };

  const runVerificationUpdate = async (verified) => {
    if (!listingId || !user?.id || isBusy) return;
    setBusy(true);
    const result = await applyListingVerificationAction({
      listingId,
      verified,
      adminUserId: user.id,
      client: supabase,
    });
    if (!result.ok) {
      console.error("[admin-listing-trust] verification update failed", result.error);
      showToast({
        type: "error",
        message: verified ? "Unable to verify listing" : "Unable to remove verification",
      });
      setBusy(false);
      return;
    }

    const patch = result.data || {};
    onUpdated?.({
      ...listing,
      verification_status: patch.verification_status ?? (verified ? "verified" : "unverified"),
      verified_at: patch.verified_at ?? (verified ? new Date().toISOString() : null),
      verified_by: patch.verified_by ?? (verified ? user.id : null),
    });
    onAction?.(verified ? "Verified listing" : "Removed listing verification");
    showToast({
      type: "success",
      message: verified ? "Listing verified" : "Verification removed",
    });
    setConfirmMode(null);
    setBusy(false);
  };

  const openConfirm = (mode) => {
    if (isBusy) return;
    if (mode === "verify") {
      void runVerificationUpdate(true);
      return;
    }
    setConfirmMode(mode);
  };

  const confirmCopy =
    confirmMode === "unverify"
      ? {
          title: "Remove verification?",
          body:
            "This listing will no longer show the verified badge on cards and detail surfaces. Other listing data stays unchanged.",
          helper: "You can verify again at any time from the admin listings panel.",
          confirmLabel: "Remove Verification",
        }
      : null;

  const chipTone = isVerified ? trustStyles.verified : "";

  if (layout === "compact") {
    return (
      <>
        <span className={`${trustStyles.chip} ${chipTone}`}>{label}</span>
        <button
          type="button"
          className={isVerified ? dashStyles.rejectButton : dashStyles.approveButton}
          disabled={isBusy}
          onClick={() => openConfirm(isVerified ? "unverify" : "verify")}
        >
          {isBusy ? "Processing…" : isVerified ? "Remove Verification" : "Verify Listing"}
        </button>
        <AdminListingActionConfirmModal
          open={Boolean(confirmCopy)}
          busy={isBusy}
          onClose={() => {
            if (isBusy) return;
            setConfirmMode(null);
          }}
          onConfirm={() => void runVerificationUpdate(false)}
          {...(confirmCopy || {})}
        />
      </>
    );
  }

  return (
    <div className={dashStyles.adminTrustAction}>
      <span className={`${trustStyles.chip} ${chipTone}`}>{label}</span>
      <button
        type="button"
        className={isVerified ? dashStyles.dashboardLink : dashStyles.approveButton}
        disabled={isBusy}
        onClick={() => openConfirm(isVerified ? "unverify" : "verify")}
      >
        {isBusy ? "Processing…" : isVerified ? "Remove Verification" : "Verify Listing"}
      </button>
      <AdminListingActionConfirmModal
        open={Boolean(confirmCopy)}
        busy={isBusy}
        onClose={() => {
          if (isBusy) return;
          setConfirmMode(null);
        }}
        onConfirm={() => void runVerificationUpdate(false)}
        {...(confirmCopy || {})}
      />
    </div>
  );
}
