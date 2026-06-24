import { getListingOwnershipSnapshot } from "../utils/ownershipAttribution";
import { getRelativeTimeLabel } from "../utils/trustSignals";
import { formatProfileDisplayLabel } from "../lib/profileDisplayName";
import styles from "./ListingOwnershipMeta.module.css";

function resolveActorName(id, ownerMap = {}) {
  const key = String(id || "").trim();
  if (!key) return "";
  if (ownerMap[key]) return ownerMap[key];
  return formatProfileDisplayLabel({ id: key });
}

export default function ListingOwnershipMeta({ listing, ownerMap }) {
  const snapshot = getListingOwnershipSnapshot(listing || {});
  const listedBy = resolveActorName(snapshot.listedBy, ownerMap);
  const managedBy = resolveActorName(snapshot.managedBy, ownerMap);
  const verifiedBy = resolveActorName(snapshot.verifiedBy, ownerMap);
  const archivedBy = resolveActorName(snapshot.archivedBy, ownerMap);
  const moderatedBy = resolveActorName(snapshot.moderatedBy, ownerMap);

  const parts = [];
  if (listedBy) parts.push(`Listed by: ${listedBy}`);
  if (managedBy && managedBy !== listedBy) parts.push(`Managed by: ${managedBy}`);
  if (verifiedBy) parts.push(`Verified by: ${verifiedBy}`);
  if (archivedBy) {
    const archivedAgo = snapshot.timestamps?.archivedAt
      ? getRelativeTimeLabel(snapshot.timestamps.archivedAt)
      : "";
    parts.push(`Archived by: ${archivedBy}${archivedAgo ? ` (${archivedAgo})` : ""}`);
  }
  else if (moderatedBy && moderatedBy !== verifiedBy) parts.push(`Moderated by: ${moderatedBy}`);

  if (!parts.length) return null;
  return <p className={styles.meta}>{parts.slice(0, 2).join(" · ")}</p>;
}

