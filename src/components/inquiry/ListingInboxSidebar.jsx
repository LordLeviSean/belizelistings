import ListingMediaImage from "@/components/listing/ListingMediaImage";
import { IMAGE_QUALITY_THUMB, IMAGE_SIZES_DASHBOARD_THUMB } from "@/constants/imageQuality";
import { inquiryTypeLabel } from "@/lib/crm/crmConstants";
import { conversationPreviewText } from "@/lib/crm/conversationMutations";
import {
  conversationDisplayStatusLabel,
  resolveConversationDisplayStatus,
} from "@/lib/crm/conversationGrouping";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { isAgentConversationUnread } from "@/lib/crm/conversationMutations";
import listStyles from "./AgentInquiryList.module.css";
import styles from "./OwnerInquiriesPanel.module.css";

export default function ListingInboxSidebar({
  groups = [],
  selectedListingId = null,
  selectedConversationId = null,
  onSelectListing,
  onSelectConversation,
  showConversationList = false,
  onBackToListings,
  showListingBack = false,
}) {
  if (!groups.length) {
    return <p className={listStyles.empty}>No listing conversations yet.</p>;
  }

  const activeGroup =
    groups.find((g) => g.listingId === selectedListingId) ||
    (showConversationList ? groups[0] : null);

  if (showConversationList && activeGroup) {
    return (
      <div className={styles.sidebarInner}>
        {showListingBack || showConversationList ? (
          <button type="button" className={styles.backBtn} onClick={onBackToListings}>
            ← All listings
          </button>
        ) : null}

        <header className={styles.listingGroupHead}>
          <div className={styles.listingThumbWrap}>
            {activeGroup.thumbnailUrl ? (
              <ListingMediaImage
                src={activeGroup.thumbnailUrl}
                alt=""
                width={48}
                height={48}
                quality={IMAGE_QUALITY_THUMB}
                sizes={IMAGE_SIZES_DASHBOARD_THUMB}
                className={styles.listingThumb}
              />
            ) : (
              <div className={styles.listingThumbPlaceholder} aria-hidden />
            )}
          </div>
          <div>
            <h3 className={styles.listingGroupTitle}>{activeGroup.title}</h3>
            <p className={styles.listingGroupMeta}>
              {activeGroup.totalCount} conversation{activeGroup.totalCount === 1 ? "" : "s"}
              {activeGroup.unreadCount > 0 ? ` · ${activeGroup.unreadCount} unread` : ""}
            </p>
          </div>
        </header>

        <div className={listStyles.list} role="list" aria-label="Conversations for listing">
          {activeGroup.conversations.map((conv) => {
            const unread = isAgentConversationUnread(conv);
            const isSelected = selectedConversationId === conv.id;
            const status = resolveConversationDisplayStatus(conv);
            const inquiry = conv?.listing_inquiries;
            const row = Array.isArray(inquiry) ? inquiry[0] : inquiry;

            return (
              <button
                key={conv.id}
                type="button"
                role="listitem"
                aria-selected={isSelected}
                className={`${listStyles.card} ${styles.convBtn} ${unread ? listStyles.cardUnread : ""} ${
                  isSelected ? styles.convBtnSelected : ""
                }`}
                onClick={() => onSelectConversation?.(conv)}
              >
                <header className={listStyles.cardHead}>
                  <span className={listStyles.channel}>
                    {conv.buyer_name || conv.buyer_email || "Guest buyer"}
                    {unread ? (
                      <span className={styles.unreadDot} aria-label="Unread">
                        {" "}
                        · New
                      </span>
                    ) : null}
                  </span>
                  <time className={listStyles.time} dateTime={conv.updated_at || conv.created_at}>
                    {formatRelativeTime(conv.updated_at || conv.created_at)}
                  </time>
                </header>
                <p className={styles.convType}>{inquiryTypeLabel(row?.inquiry_type || "general")}</p>
                <p className={listStyles.body}>{conversationPreviewText(conv)}</p>
                <span className={listStyles.statusPill}>{conversationDisplayStatusLabel(status)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={listStyles.list} role="list" aria-label="Listings with inquiries">
      {groups.map((group) => {
        const isSelected = selectedListingId === group.listingId;
        return (
          <button
            key={group.listingId}
            type="button"
            role="listitem"
            aria-selected={isSelected}
            className={`${listStyles.card} ${styles.listingGroupBtn} ${
              group.unreadCount > 0 ? listStyles.cardUnread : ""
            } ${isSelected ? styles.convBtnSelected : ""}`}
            onClick={() => onSelectListing?.(group)}
          >
            <div className={styles.listingGroupRow}>
              <div className={styles.listingThumbWrap}>
                {group.thumbnailUrl ? (
                  <ListingMediaImage
                    src={group.thumbnailUrl}
                    alt=""
                    width={56}
                    height={56}
                    quality={IMAGE_QUALITY_THUMB}
                    sizes={IMAGE_SIZES_DASHBOARD_THUMB}
                    className={styles.listingThumb}
                  />
                ) : (
                  <div className={styles.listingThumbPlaceholder} aria-hidden />
                )}
              </div>
              <div className={styles.listingGroupCopy}>
                <header className={listStyles.cardHead}>
                  <span className={listStyles.listingRef}>{group.title}</span>
                  <time className={listStyles.time} dateTime={group.latestAt}>
                    {group.latestAt ? formatRelativeTime(group.latestAt) : ""}
                  </time>
                </header>
                <p className={listStyles.body}>
                  {group.totalCount} conversation{group.totalCount === 1 ? "" : "s"}
                  {group.unreadCount > 0
                    ? ` · ${group.unreadCount} unread`
                    : ""}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
