import { useEffect } from "react";
import { useRouter } from "next/router";
import modalStyles from "@/components/user/UserUpgradePathModal.module.css";
import {
  GEOGRAPHIC_UPDATE_MODAL_COPY,
  markGeographicUpdateModalSeen,
  resolveGeographicUpdateListingsHref,
} from "@/lib/geography/geographicUpdateLaunch";

export default function GeographicUpdateModal({ open, onClose, user, role, supabase }) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const href = resolveGeographicUpdateListingsHref(role);

  const dismiss = async (action) => {
    await markGeographicUpdateModalSeen(user?.id, supabase, { action });
    onClose?.();
  };

  return (
    <div
      className={modalStyles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss("dismiss");
      }}
    >
      <div
        className={modalStyles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="geo-update-title"
      >
        <h2 id="geo-update-title" className={modalStyles.headline}>
          {GEOGRAPHIC_UPDATE_MODAL_COPY.title}
        </h2>
        <p className={modalStyles.subtext}>{GEOGRAPHIC_UPDATE_MODAL_COPY.body}</p>
        <div className={modalStyles.options}>
          <button
            type="button"
            className={modalStyles.optionBtn}
            onClick={async () => {
              await dismiss("cta");
              router.push(href);
            }}
          >
            <strong>{GEOGRAPHIC_UPDATE_MODAL_COPY.primaryCta}</strong>
          </button>
          <button
            type="button"
            className={modalStyles.closeBtn}
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => dismiss("explore")}
          >
            {GEOGRAPHIC_UPDATE_MODAL_COPY.secondaryCta}
          </button>
          <button type="button" className={modalStyles.closeBtn} onClick={() => dismiss("dismiss")}>
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
