/** @returns {boolean} Skip postgres_changes reload while verify/unverify is active. */
export function shouldSkipVerificationRealtimeReload(actionKey = "", unverifyTargetId = "") {
  if (String(unverifyTargetId || "").trim()) return true;
  return String(actionKey).endsWith(":verify");
}

export const UNVERIFY_CONFIRM_COPY = {
  title: "Remove verification?",
  body:
    "This listing will no longer show the verified badge on cards and detail surfaces. Other listing data stays unchanged.",
  helper: "You can verify again at any time from the admin listings panel.",
  confirmLabel: "Remove Verification",
};
