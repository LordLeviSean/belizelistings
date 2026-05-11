import {
  Copy,
  ImagePlus,
  LayoutGrid,
  Plus,
  RotateCcw,
  Share2,
  Archive,
} from "lucide-react";
import opStyles from "./OperationalIntel.module.css";

export default function AgentQuickActionBar({
  onCreate,
  onResumeDraft,
  draftCount = 0,
  hasListings = true,
}) {
  return (
    <nav className={opStyles.quickBar} aria-label="Quick actions">
      <button type="button" className={`${opStyles.quickBtn} ${opStyles.quickBtnPrimary}`} onClick={onCreate}>
        <Plus size={16} strokeWidth={2.25} aria-hidden />
        Create listing
      </button>
      <button
        type="button"
        className={opStyles.quickBtn}
        onClick={onResumeDraft}
        disabled={draftCount === 0}
        title={draftCount === 0 ? "No drafts yet" : `${draftCount} draft(s)`}
      >
        <RotateCcw size={16} strokeWidth={2} aria-hidden />
        Resume draft
        {draftCount > 0 ? ` (${draftCount})` : ""}
      </button>
      <button type="button" className={opStyles.quickBtn} disabled title="Coming soon">
        <ImagePlus size={16} strokeWidth={2} aria-hidden />
        Upload photos
      </button>
      <button type="button" className={opStyles.quickBtn} disabled={!hasListings} title="Pick a listing first">
        <Copy size={16} strokeWidth={2} aria-hidden />
        Duplicate
      </button>
      <button type="button" className={opStyles.quickBtn} disabled title="Coming soon">
        <Share2 size={16} strokeWidth={2} aria-hidden />
        Share
      </button>
      <button type="button" className={opStyles.quickBtn} disabled title="Use listing actions below">
        <Archive size={16} strokeWidth={2} aria-hidden />
        Archive
      </button>
      <button type="button" className={opStyles.quickBtn} disabled title="Overview">
        <LayoutGrid size={16} strokeWidth={2} aria-hidden />
        Insights
      </button>
    </nav>
  );
}
