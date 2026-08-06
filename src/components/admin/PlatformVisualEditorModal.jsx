import { useCallback, useEffect, useRef, useState } from "react";
import { useVisualMode } from "../VisualModeProvider";
import {
  SEA_FLOW_INTENSITY_MIN,
  SEA_FLOW_INTENSITY_MAX,
  getSeaFlowIntensityLabel,
  seaFlowIntensityFromPercent,
  seaFlowIntensityToPercent,
} from "../../utils/seaFlowIntensity";
import styles from "./PlatformVisualEditorModal.module.css";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function boolLabel(value) {
  return value ? "On" : "Off";
}

export default function PlatformVisualEditorModal({ open, onClose }) {
  const {
    livePalette,
    pulse,
    seaFlow,
    seaFlowIntensity,
    updateVisualMode,
    updating,
    updateError,
  } = useVisualMode();

  const modalRef = useRef(null);
  const saveRef = useRef(null);
  const [draft, setDraft] = useState({
    livePalette,
    pulse,
    seaFlow,
    seaFlowIntensity,
  });
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDraft({ livePalette, pulse, seaFlow, seaFlowIntensity });
    setSaveMessage(null);
  }, [open, livePalette, pulse, seaFlow, seaFlowIntensity]);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || updating) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, updating]);

  useEffect(() => {
    if (!open || !modalRef.current) return undefined;
    const modal = modalRef.current;
    const focusables = Array.from(modal.querySelectorAll(FOCUSABLE));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    saveRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key !== "Tab" || focusables.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    modal.addEventListener("keydown", onKeyDown);
    return () => modal.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const intensityPercent = seaFlowIntensityToPercent(draft.seaFlowIntensity);
  const savedIntensityLabel = getSeaFlowIntensityLabel(seaFlowIntensity);

  const handleSave = useCallback(async () => {
    setSaveMessage(null);
    try {
      await updateVisualMode(draft);
      setSaveMessage({ type: "success", text: "Platform visual settings saved." });
      onClose?.();
    } catch {
      /* updateError surfaced from provider */
    }
  }, [draft, onClose, updateVisualMode]);

  const handleCancel = useCallback(() => {
    if (updating) return;
    onClose?.();
  }, [onClose, updating]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !updating) handleCancel();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-visual-editor-title"
        aria-describedby="platform-visual-editor-desc"
      >
        <header className={styles.header}>
          <h2 id="platform-visual-editor-title" className={styles.title}>
            Platform Visual Editor
          </h2>
          <p id="platform-visual-editor-desc" className={styles.lead}>
            Changes apply globally to all visitors and supported pages on their next load.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="wordmark-effects-heading">
          <h3 id="wordmark-effects-heading" className={styles.sectionTitle}>
            Wordmark
          </h3>
          <div className={styles.controls}>
            <div className={styles.controlRow}>
              <div className={styles.controlCopy}>
                <p className={styles.controlLabel}>Live Palette</p>
                <p className={styles.controlHint}>
                  Cycles brand colours on the BelizeListings wordmark. Saved: {boolLabel(livePalette)}.
                </p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={draft.livePalette}
                  onChange={(e) => setDraft((d) => ({ ...d, livePalette: e.target.checked }))}
                  disabled={updating}
                  aria-label="Toggle live palette"
                />
                <span className={styles.switchSlider} />
              </label>
            </div>

            <div className={styles.controlRow}>
              <div className={styles.controlCopy}>
                <p className={styles.controlLabel}>Logo Pulse</p>
                <p className={styles.controlHint}>
                  Subtle pulse on the wordmark. Respects reduced motion. Saved: {boolLabel(pulse)}.
                </p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={draft.pulse}
                  onChange={(e) => setDraft((d) => ({ ...d, pulse: e.target.checked }))}
                  disabled={updating}
                  aria-label="Toggle logo pulse"
                />
                <span className={styles.switchSlider} />
              </label>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="sea-flow-heading">
          <h3 id="sea-flow-heading" className={styles.sectionTitle}>
            Sea Flow background
          </h3>
          <div className={styles.controls}>
            <div className={styles.controlRow}>
              <div className={styles.controlCopy}>
                <p className={styles.controlLabel}>Sea Flow</p>
                <p className={styles.controlHint}>
                  Animated coastal wash behind page content. Saved: {boolLabel(seaFlow)}.
                </p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={draft.seaFlow}
                  onChange={(e) => setDraft((d) => ({ ...d, seaFlow: e.target.checked }))}
                  disabled={updating}
                  aria-label="Toggle sea flow background"
                />
                <span className={styles.switchSlider} />
              </label>
            </div>

            <div
              className={`${styles.intensityBlock} ${draft.seaFlow ? "" : styles.intensityBlockDisabled}`}
            >
              <div className={styles.intensityHeader}>
                <p className={styles.controlLabel}>Sea Flow intensity</p>
                <p className={styles.intensityValue} aria-live="polite">
                  {getSeaFlowIntensityLabel(draft.seaFlowIntensity)}
                </p>
              </div>
              <p className={styles.controlHint}>
                50% is baseline movement. Saved: {savedIntensityLabel}.
              </p>
              <input
                type="range"
                className={styles.intensitySlider}
                min={seaFlowIntensityToPercent(SEA_FLOW_INTENSITY_MIN)}
                max={seaFlowIntensityToPercent(SEA_FLOW_INTENSITY_MAX)}
                step={5}
                value={intensityPercent}
                disabled={!draft.seaFlow || updating}
                aria-valuemin={50}
                aria-valuemax={150}
                aria-valuenow={intensityPercent}
                aria-label="Sea flow intensity"
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    seaFlowIntensity: seaFlowIntensityFromPercent(e.target.value),
                  }))
                }
              />
              <div className={styles.intensityScale} aria-hidden="true">
                <span>50%</span>
                <span>150%</span>
              </div>
            </div>
          </div>
        </section>

        {updateError ? (
          <p className={styles.feedbackError} role="alert">
            {updateError}
          </p>
        ) : null}
        {saveMessage?.type === "success" ? (
          <p className={styles.feedbackSuccess} role="status">
            {saveMessage.text}
          </p>
        ) : null}

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={updating}
          >
            Cancel
          </button>
          <button
            ref={saveRef}
            type="button"
            className={styles.saveButton}
            onClick={() => void handleSave()}
            disabled={updating}
          >
            {updating ? "Saving…" : "Save Changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
