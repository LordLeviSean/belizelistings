import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import useUserRole from "@/hooks/useUserRole";
import { isProfileComplete } from "@/lib/isProfileComplete";
import { updateProfileContact } from "@/lib/profileContactMutations";
import { supabase } from "@/lib/supabaseClient";
import dashboardStyles from "@/styles/Dashboard.module.css";
import styles from "./ProfileCompletionPanel.module.css";

function normalizePhoneInput(value) {
  return String(value ?? "").trim();
}

export default function ProfileCompletionPanel({ compact = false }) {
  const { profile, user, refetchProfile } = useUserRole();
  const { showToast } = useToast();
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [brokerageName, setBrokerageName] = useState("");
  const [brokeragePhone, setBrokeragePhone] = useState("");
  const [showEmailPublic, setShowEmailPublic] = useState(false);
  const [showPhonePublic, setShowPhonePublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const email = profile?.email ?? user?.email ?? "";
  const complete = isProfileComplete(profile);

  useEffect(() => {
    setPhone(String(profile?.phone ?? ""));
    setWhatsapp(String(profile?.whatsapp ?? ""));
    setBrokerageName(String(profile?.brokerage_name ?? ""));
    setBrokeragePhone(String(profile?.brokerage_phone ?? ""));
    setShowEmailPublic(profile?.show_email_public === true && Boolean(String(profile?.contact_email_display ?? "").trim()));
    setShowPhonePublic(profile?.show_phone_public !== false);
  }, [profile]);

  const handleSave = useCallback(async () => {
    if (!user?.id || saving) return;
    const normalizedPhone = normalizePhoneInput(phone);
    if (normalizedPhone.replace(/\D/g, "").length < 7) {
      setPhoneError("Enter a valid phone number (at least 7 digits).");
      return;
    }
    setPhoneError("");
    setSaving(true);
    const { data, error } = await updateProfileContact(supabase, user.id, {
      phone: normalizedPhone,
      whatsapp,
      brokerage_name: brokerageName,
      brokerage_phone: brokeragePhone,
      show_email_public: showEmailPublic,
      show_phone_public: showPhonePublic,
      auth_email: email,
      profile_completed_at: profile?.profile_completed_at,
    });
    setSaving(false);
    if (error) {
      showToast({ type: "error", message: error.message || "Could not save profile." });
      return;
    }
    await refetchProfile?.();
    showToast({
      type: "success",
      message: complete ? "Contact details updated." : "Profile complete — you can submit listings for review.",
    });
    if (data) {
      setPhone(String(data.phone ?? normalizedPhone));
    }
  }, [
    brokerageName,
    brokeragePhone,
    complete,
    phone,
    profile?.profile_completed_at,
    refetchProfile,
    saving,
    showEmailPublic,
    showPhonePublic,
    showToast,
    user?.id,
    whatsapp,
  ]);

  return (
    <section
      className={`${styles.panel} ${compact ? styles.panelCompact : ""}`}
      aria-label="Profile and contact details"
    >
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Your contact profile</h2>
          <p className={styles.lede}>
            Buyers reach you through this profile — not individual listings. Phone is required before
            submit-for-review.
          </p>
        </div>
        {complete ? (
          <span className={styles.completeBadge}>Complete</span>
        ) : (
          <span className={styles.incompleteBadge}>Phone required</span>
        )}
      </header>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.label}>
            Phone <span className={styles.required} aria-hidden>*</span>
          </span>
          <input
            className={dashboardStyles.input}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+501 600 1234"
            aria-required="true"
            aria-invalid={Boolean(phoneError)}
          />
          {phoneError ? <span className={dashboardStyles.inputError}>{phoneError}</span> : null}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>WhatsApp (optional)</span>
          <input
            className={dashboardStyles.input}
            type="tel"
            autoComplete="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Same as phone if left blank"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Email (from account)</span>
          <input
            className={`${dashboardStyles.input} ${styles.readOnly}`}
            type="email"
            value={email}
            readOnly
            aria-readonly="true"
          />
          <span className={styles.hint}>Managed by your BelizeListings sign-in.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Brokerage name (optional)</span>
          <input
            className={dashboardStyles.input}
            type="text"
            value={brokerageName}
            onChange={(e) => setBrokerageName(e.target.value)}
            placeholder="Office or team name"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Brokerage phone (optional)</span>
          <input
            className={dashboardStyles.input}
            type="tel"
            value={brokeragePhone}
            onChange={(e) => setBrokeragePhone(e.target.value)}
            placeholder="Main office line"
          />
        </label>
      </div>

      <fieldset className={styles.privacyGroup}>
        <legend className={styles.privacyLegend}>Public visibility</legend>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={showPhonePublic}
            onChange={(e) => setShowPhonePublic(e.target.checked)}
          />
          <span>Show phone on listing contact cards</span>
        </label>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={showEmailPublic}
            onChange={(e) => setShowEmailPublic(e.target.checked)}
          />
          <span>Show my email publicly</span>
        </label>
      </fieldset>

      <div className={styles.actions}>
        <button
          type="button"
          className={dashboardStyles.primaryButton}
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save contact details"}
        </button>
      </div>
    </section>
  );
}
