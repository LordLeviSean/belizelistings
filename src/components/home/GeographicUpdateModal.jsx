import { useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { MapPin } from "lucide-react";
import ListingInteractionModal from "@/components/listing/ListingInteractionModal";
import {
  GEOGRAPHIC_UPDATE_MODAL_COPY,
  markGeographicUpdateModalSeen,
  resolveGeographicUpdateListingsHref,
} from "@/lib/geography/geographicUpdateLaunch";
import styles from "./GeographicUpdateModal.module.css";

export default function GeographicUpdateModal({ open, onClose, user, role, supabase }) {
  const router = useRouter();
  const primaryRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      primaryRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const href = resolveGeographicUpdateListingsHref(role);

  const dismiss = async (action) => {
    await markGeographicUpdateModalSeen(user?.id, supabase, { action });
    onClose?.();
  };

  return (
    <ListingInteractionModal
      isOpen={open}
      onClose={() => dismiss("dismiss")}
      title={GEOGRAPHIC_UPDATE_MODAL_COPY.title}
      titleId="geo-update-title"
      eyebrow={
        <span className={styles.eyebrow}>
          <MapPin size={13} strokeWidth={2.25} aria-hidden />
          PLATFORM UPDATE
        </span>
      }
      backdropClassName={styles.geoBackdrop}
      panelClassName={styles.geoPanel}
      dismissOnBackdrop
    >
      <p className={styles.body}>{GEOGRAPHIC_UPDATE_MODAL_COPY.body}</p>
      <div className={styles.actions}>
        <button
          ref={primaryRef}
          type="button"
          className={styles.primaryBtn}
          onClick={async () => {
            await dismiss("cta");
            router.push(href);
          }}
        >
          {GEOGRAPHIC_UPDATE_MODAL_COPY.primaryCta}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => dismiss("explore")}>
          {GEOGRAPHIC_UPDATE_MODAL_COPY.secondaryCta}
        </button>
        <button type="button" className={styles.tertiaryLink} onClick={() => dismiss("dismiss")}>
          Not now
        </button>
      </div>
    </ListingInteractionModal>
  );
}
