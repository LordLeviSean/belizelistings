import { CREATE_FORM_INITIAL } from "../utils/createListingForm";
import { sanitizeAmenitiesArray } from "../constants/listingAmenities";

export function serializeCreateWorkspaceForm(form = {}) {
  const out = {};
  for (const key of Object.keys(CREATE_FORM_INITIAL)) {
    const value = form[key];
    if (key === "amenities") {
      out[key] = sanitizeAmenitiesArray(Array.isArray(value) ? value : []).slice().sort();
      continue;
    }
    out[key] = value ?? CREATE_FORM_INITIAL[key];
  }
  return JSON.stringify(out);
}

export function serializeRemoteImageSnapshot(images = []) {
  return JSON.stringify(
    (images || [])
      .filter((row) => row?.id || row?.image_url)
      .map((row, index) => ({
        id: row.id != null ? String(row.id) : "",
        position: Number(row.position ?? index),
        image_url: String(row.image_url || ""),
      }))
      .sort((a, b) => a.position - b.position)
  );
}

export function captureCreateWorkspaceSessionBaseline({ form, remoteImages = [] }) {
  return {
    form: { ...CREATE_FORM_INITIAL, ...(form || {}) },
    remoteImages: (remoteImages || []).map((row) => ({ ...row })),
  };
}

export function hasCreateWorkspaceSessionChanges({
  form,
  baseline,
  remoteImages,
  dirty = false,
  pendingUploadCount = 0,
  imageOrderDirty = false,
}) {
  if (!baseline) return dirty || pendingUploadCount > 0 || imageOrderDirty;
  if (pendingUploadCount > 0) return true;
  if (imageOrderDirty) return true;
  if (dirty) return true;
  if (serializeCreateWorkspaceForm(form) !== serializeCreateWorkspaceForm(baseline.form)) return true;
  if (
    serializeRemoteImageSnapshot(remoteImages) !==
    serializeRemoteImageSnapshot(baseline.remoteImages)
  ) {
    return true;
  }
  return false;
}

/**
 * Decide whether exit should discard a session-created draft or restore a pre-existing listing.
 */
export function resolveCreateWorkspaceExitAction({
  openedWithDraftId = "",
  draftCreatedInSession = false,
  draftListingId = "",
}) {
  const openedWithDraft = Boolean(String(openedWithDraftId || "").trim());
  const hasDraft = Boolean(String(draftListingId || "").trim());
  if (draftCreatedInSession && hasDraft && !openedWithDraft) {
    return "discard_session_draft";
  }
  if (openedWithDraft && hasDraft) {
    return "restore_baseline";
  }
  return "leave_only";
}

export function resolveCreateWorkspaceExitCopy({ exitAction, isEditingExistingListing }) {
  if (exitAction === "discard_session_draft") {
    return {
      title: "Exit without saving?",
      body: "Your unsaved listing and any new draft data from this session will be removed.",
      confirmLabel: "Exit Without Saving",
    };
  }
  if (isEditingExistingListing || exitAction === "restore_baseline") {
    return {
      title: "Exit without saving?",
      body: "Changes made during this editing session will be discarded. Your published listing will remain unchanged.",
      confirmLabel: "Exit Without Saving",
    };
  }
  return {
    title: "Exit without saving?",
    body: "Your unsaved listing and any new draft data from this session will be removed.",
    confirmLabel: "Exit Without Saving",
  };
}

export function mapCreateWorkspaceExitError(error) {
  const msg = String(error?.message || "").trim();
  if (!msg) return "Unable to exit without saving. Please try again.";
  if (/only drafts can be discarded/i.test(msg)) {
    return "This listing cannot be removed from here. Please keep editing or use Save & exit.";
  }
  if (/not allowed to permanently delete/i.test(msg)) {
    return "Unable to discard this draft. Please try again from My Listings.";
  }
  if (/unable to restore/i.test(msg)) return msg;
  if (/draft not found/i.test(msg)) return "This draft is no longer available.";
  return "Unable to exit without saving. Please try again.";
}
