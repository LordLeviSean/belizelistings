import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { createDebugger } from "@/lib/debug";
import SiteNav from "../../components/SiteNav";
import BackButton from "../../components/BackButton";
import Breadcrumbs from "../../components/Breadcrumbs";
import AgentAccessGate from "../../components/AgentAccessGate";
import useAuth from "../../hooks/useAuth";
import useRoleAccess from "../../hooks/useRoleAccess";
import { supabase } from "../../lib/supabaseClient";
import { traceAction, traceLog } from "../../lib/trace";
import { useToast } from "../../components/ui/ToastProvider";
import {
  getSelectableRegions,
  getRegionLabel,
  normalizeRegionSlug,
} from "../../constants/geographyLayer";
import { AGENT_FREE_ACTIVE_LISTING_CAP, PLATFORM_TIERS } from "../../constants/operationalModel";
import {
  buildCreateListingPayload,
  getUserActiveListingCount,
  safeInsertListing,
} from "../../lib/listingPersistence";
import styles from "../../styles/Dashboard.module.css";

const INITIAL_FORM = {
  title: "",
  price: "",
  property_type: "",
  district: "",
  listing_type: "sale",
  beds: "",
  baths: "",
};
const PROPERTY_TYPES = ["house", "apartment", "condo", "land", "commercial"];
const DISTRICTS = getSelectableRegions().map((region) => region.label);

/** Ordered stages shown as the main title in the submission overlay */
const SUBMISSION_STAGE = {
  PREPARING: "preparing",
  UPLOADING: "uploading",
  PROCESSING: "processing",
  FINALIZING: "finalizing",
  COMPLETED: "completed",
};

const STAGE_LABELS = {
  [SUBMISSION_STAGE.PREPARING]: "Preparing Listing",
  [SUBMISSION_STAGE.UPLOADING]: "Uploading Images",
  [SUBMISSION_STAGE.PROCESSING]: "Processing Listing",
  [SUBMISSION_STAGE.FINALIZING]: "Finalizing Submission",
  [SUBMISSION_STAGE.COMPLETED]: "Completed",
};

const PROCESSING_NARRATIVES = [
  "Processing Listing",
  "Preparing moderation pipeline",
  "Finalizing inventory submission",
];

const UPLOAD_NARRATIVES = [
  "Securely transferring your images",
  "Optimizing media for review",
  "Almost there — your listing stays active in the queue",
];

const FINALIZING_NARRATIVES = [
  "Finalizing Submission",
  "Preparing moderation pipeline",
  "Finalizing inventory submission",
];

function safeFileSlug(name = "") {
  return String(name || "image")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function qv(value) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function districtForSelect(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  return getRegionLabel(raw);
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

export default function DashboardCreatePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { roleLoading, canCreateListings, tier, isAdmin } = useRoleAccess(user?.id);
  const [form, setForm] = useState(INITIAL_FORM);
  const [files, setFiles] = useState([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [success, setSuccess] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errors, setErrors] = useState({});
  const debugRef = useRef(createDebugger("CREATE_FLOW"));
  const prefillAppliedRef = useRef(false);
  const [debugState, setDebugState] = useState({});
  const { showToast } = useToast();
  const [linkedPropertyId, setLinkedPropertyId] = useState("");
  const [linkedUnitId, setLinkedUnitId] = useState("");
  const [prefilledFields, setPrefilledFields] = useState({
    price: false,
    district: false,
    property_type: false,
    listing_type: false,
  });

  const [submissionPhase, setSubmissionPhase] = useState(SUBMISSION_STAGE.PREPARING);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [narrativeIndex, setNarrativeIndex] = useState(0);
  const [narrativeFade, setNarrativeFade] = useState(false);
  const [showCompletionCard, setShowCompletionCard] = useState(false);
  const [overlayExiting, setOverlayExiting] = useState(false);

  const targetProgressRef = useRef(0);
  const visualProgressRef = useRef(0);
  const progressRafRef = useRef(null);
  const lastProgressPaintRef = useRef(0);

  const isDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "true";

  const setProgressTarget = useCallback((next, jitterCap = 2) => {
    const capped = clamp(next, 0, 100);
    targetProgressRef.current = capped;
    if (visualProgressRef.current > capped + jitterCap) {
      visualProgressRef.current = capped;
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  /** Smooth, non-linear progress + subtle motion while waiting on async work */
  useEffect(() => {
    const overlayActive = loadingCreate || showCompletionCard;
    if (!overlayActive) {
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
      visualProgressRef.current = 0;
      targetProgressRef.current = 0;
      setSmoothProgress(0);
      return;
    }

    const loop = (t) => {
      const target = targetProgressRef.current;
      let cur = visualProgressRef.current;
      const gap = target - cur;
      const easing = 1 - Math.exp(-0.09);
      cur += gap * easing;
      if (Math.abs(gap) < 0.04) {
        cur = target;
      }
      if (submissionPhase !== SUBMISSION_STAGE.COMPLETED && target < 99.5 && Math.abs(target - cur) < 2.5) {
        cur += 0.018 * (0.85 + 0.15 * Math.sin(t / 1400));
        cur = Math.min(cur, target + 1.8);
      }
      if (submissionPhase === SUBMISSION_STAGE.COMPLETED) {
        cur = Math.max(cur, target);
      }
      cur = clamp(cur, 0, 100);
      visualProgressRef.current = cur;

      if (t - lastProgressPaintRef.current > 48) {
        lastProgressPaintRef.current = t;
        setSmoothProgress(cur);
      }

      progressRafRef.current = requestAnimationFrame(loop);
    };

    progressRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    };
  }, [loadingCreate, showCompletionCard, submissionPhase]);

  /** Rotate operational sublines during long phases */
  useEffect(() => {
    if (!loadingCreate || submissionPhase === SUBMISSION_STAGE.COMPLETED) return undefined;

    const lines =
      submissionPhase === SUBMISSION_STAGE.UPLOADING
        ? UPLOAD_NARRATIVES
        : submissionPhase === SUBMISSION_STAGE.FINALIZING
          ? FINALIZING_NARRATIVES
          : PROCESSING_NARRATIVES;
    if (submissionPhase === SUBMISSION_STAGE.PREPARING) return undefined;

    const tick = () => {
      setNarrativeFade(true);
      window.setTimeout(() => {
        setNarrativeIndex((i) => (i + 1) % lines.length);
        setNarrativeFade(false);
      }, 220);
    };

    const id = window.setInterval(tick, 2800);
    return () => window.clearInterval(id);
  }, [loadingCreate, submissionPhase]);

  useEffect(() => {
    if (!router.isReady || prefillAppliedRef.current) return;
    const prefillPrice = String(qv(router.query.price) || "");
    const prefillDistrict = districtForSelect(qv(router.query.district));
    const prefillPropertyType = String(qv(router.query.property_type) || "").toLowerCase();
    const prefillListingType = String(qv(router.query.listing_type) || "").toLowerCase();
    const prefillPropertyId = String(qv(router.query.propertyId) || "");
    const prefillUnitId = String(qv(router.query.unitId) || "");
    const nextPrefilled = {
      price: Boolean(prefillPrice),
      district: Boolean(prefillDistrict),
      property_type: PROPERTY_TYPES.includes(prefillPropertyType),
      listing_type: prefillListingType === "rent" || prefillListingType === "sale",
    };

    setForm((prev) => ({
      ...prev,
      price: prefillPrice || prev.price,
      district: prefillDistrict || prev.district,
      property_type: PROPERTY_TYPES.includes(prefillPropertyType) ? prefillPropertyType : prev.property_type,
      listing_type: prefillListingType === "rent" || prefillListingType === "sale" ? prefillListingType : prev.listing_type,
    }));
    setPrefilledFields(nextPrefilled);
    setLinkedPropertyId(prefillPropertyId);
    setLinkedUnitId(prefillUnitId);
    prefillAppliedRef.current = true;
  }, [router.isReady, router.query]);

  const setField = (field) => (event) => {
    setErrors((current) => ({ ...current, [field]: "" }));
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loadingCreate) return;
    let createSucceeded = false;

    try {
      setLoadingCreate(true);
      setSuccess(false);
      setFeedback("");
      setShowCompletionCard(false);
      setOverlayExiting(false);
      setSubmissionPhase(SUBMISSION_STAGE.PREPARING);
      setNarrativeIndex(0);
      setNarrativeFade(false);
      visualProgressRef.current = 0;
      targetProgressRef.current = 0;
      setProgressTarget(8);

      traceLog("START CREATE FLOW");

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      traceLog("AUTH USER ID:", authUser?.id);
      debugRef.current.log("USER", authUser);
      setDebugState(debugRef.current.getState());

      if (!authUser?.id) {
        setFeedback("User not authenticated");
        showToast({ type: "error", message: "Please sign in again" });
        return;
      }

      setProgressTarget(14);

      const title = form.title.trim();
      const district = normalizeRegionSlug(form.district);
      const property_type = form.property_type.trim().toLowerCase();
      const price = Number(form.price);
      const beds = Number(form.beds || 0);
      const baths = Number(form.baths || 0);
      const nextErrors = {};
      if (!title) nextErrors.title = "Title is required.";
      if (!property_type || !PROPERTY_TYPES.includes(property_type)) {
        nextErrors.property_type = "Select a valid property type.";
      }
      const districtSlugs = getSelectableRegions().map((region) => region.slug);
      if (!district || !districtSlugs.includes(district)) {
        nextErrors.district = "Select a valid region.";
      }
      if (Number.isNaN(price) || price <= 0) nextErrors.price = "Enter a valid price.";
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) {
        setFeedback("Please fix the highlighted fields.");
        return;
      }

      setProgressTarget(18);

      const listing_type = form.listing_type;
      const activeCount = await getUserActiveListingCount(supabase, authUser.id);
      if (tier === PLATFORM_TIERS.AGENT_FREE && activeCount >= AGENT_FREE_ACTIVE_LISTING_CAP) {
        throw new Error(
          `Free Agent tier limit reached (${AGENT_FREE_ACTIVE_LISTING_CAP} active listings).`
        );
      }

      const payload = buildCreateListingPayload({
        form: {
          title,
          price,
          property_type,
          district,
          listing_type,
          beds,
          baths,
        },
        authUserId: authUser.id,
        linkedPropertyId,
        linkedUnitId,
      });
      traceLog("INSERT PAYLOAD:", payload);
      traceAction({ type: "create_listing", payload });
      debugRef.current.log("LISTING_PAYLOAD", payload);

      setSubmissionPhase(SUBMISSION_STAGE.PROCESSING);
      setProgressTarget(28);
      setNarrativeIndex(0);

      const insertResult = await safeInsertListing(supabase, payload);
      let { data: listingData, error, meta: insertMeta } = insertResult;
      debugRef.current.log("LISTING_RESULT", { data: listingData, error });
      setDebugState(debugRef.current.getState());
      traceAction({
        type: "create_listing_result",
        payload: { title: payload.title, user_id: payload.user_id },
        result: { listingId: listingData?.id ?? null, error: error?.message ?? null },
      });
      if (error || !listingData) throw error || new Error("Could not create listing.");

      setProgressTarget(48);

      traceLog("INSERT SUCCESS:", listingData.id);
      if (insertMeta?.strippedKeys?.length) {
        traceLog("INSERT STRIPPED COLUMNS (compat):", insertMeta.strippedKeys);
      }
      if (insertMeta?.usedMinimalFinalSafe) {
        traceLog("INSERT used minimal-final-safe payload (title, price, status, user_id only)");
      }
      if (insertMeta?.skipOwnershipEnrichment) {
        traceLog(
          "SKIP post-insert ownership / canonical column enrichment (partial schema compat or minimal insert)"
        );
      }

      if (linkedUnitId) {
        setProgressTarget(52);
        const { data: unitRow, error: unitLoadError } = await supabase
          .from("units")
          .select("id,status,vacant_since")
          .eq("id", linkedUnitId)
          .maybeSingle();
        if (!unitLoadError && unitRow && String(unitRow.status || "").toLowerCase() !== "occupied") {
          const nextVacantSince = unitRow.vacant_since || new Date().toISOString();
          const { error: unitUpdateError } = await supabase
            .from("units")
            .update({
              status: "vacant",
              vacant_since: nextVacantSince,
            })
            .eq("id", linkedUnitId);
          if (unitUpdateError) {
            console.error("[create-listing] unable to sync linked unit vacancy state", unitUpdateError);
          }
        }
      }

      const listingId = listingData.id;
      const nFiles = files.filter(Boolean).length;

      if (nFiles > 0) {
        setSubmissionPhase(SUBMISSION_STAGE.UPLOADING);
        setNarrativeIndex(0);
        setProgressTarget(54);
      } else {
        setProgressTarget(72);
      }

      const uploadFailures = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        debugRef.current.log("UPLOAD_FILE_INDEX", i);
        const fileName = safeFileSlug(file.name);
        const filePath = `${authUser.id}/${Date.now()}-${i}-${fileName}`;
        debugRef.current.log("FILE_PATH", filePath);

        const span = 28;
        const base = 54;
        setProgressTarget(base + ((i + 0.35) / Math.max(nFiles, 1)) * span);

        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("listing-images")
            .upload(filePath, file, {
              upsert: false,
              contentType: file.type || undefined,
            });
          traceLog("UPLOAD RESULT:", uploadData);
          if (uploadError) throw uploadError;

          setProgressTarget(base + ((i + 0.72) / Math.max(nFiles, 1)) * span);

          const { data: publicUrlData } = supabase.storage.from("listing-images").getPublicUrl(filePath);
          const publicUrl = publicUrlData?.publicUrl;
          if (publicUrl) {
            const { error: imageError } = await supabase.from("listing_images").insert({
              listing_id: listingId,
              image_url: publicUrl,
              position: i,
            });
            if (imageError) throw imageError;
          }
          setProgressTarget(base + ((i + 1) / Math.max(nFiles, 1)) * span);
        } catch (uploadErr) {
          console.error("[create-listing] image upload failed", {
            index: i,
            file: file?.name,
            message: uploadErr?.message || String(uploadErr),
          });
          uploadFailures.push(file?.name || `image-${i + 1}`);
        }
      }

      if (uploadFailures.length) {
        showToast({
          type: "info",
          message: `Listing created, but ${uploadFailures.length} image upload${
            uploadFailures.length === 1 ? "" : "s"
          } failed. Check Supabase storage bucket/policies for "listing-images".`,
        });
      }

      traceLog("CREATE FLOW COMPLETE");

      setSubmissionPhase(SUBMISSION_STAGE.FINALIZING);
      setNarrativeIndex(0);
      setProgressTarget(92);

      await new Promise((r) => setTimeout(r, 380));

      setProgressTarget(97);
      setSubmissionPhase(SUBMISSION_STAGE.COMPLETED);
      setShowCompletionCard(true);
      setProgressTarget(100);

      createSucceeded = true;
      setSuccess(true);
      setLoadingCreate(false);
      showToast({ type: "success", message: "Listing submitted for approval" });

      await new Promise((r) => setTimeout(r, 2000));

      setOverlayExiting(true);
      await new Promise((r) => setTimeout(r, 480));

      router.push(isAdmin ? "/admin?tab=pending" : "/dashboard/agent");
    } catch (createError) {
      console.error("CREATE ERROR:", createError);
      setFeedback(createError?.message || "Failed to create listing");
      showToast({ type: "error", message: createError?.message || "Failed to create listing" });
    } finally {
      setLoadingCreate(false);
      if (!createSucceeded) {
        setShowCompletionCard(false);
        setSubmissionPhase(SUBMISSION_STAGE.PREPARING);
        setProgressTarget(0);
        visualProgressRef.current = 0;
        targetProgressRef.current = 0;
        setSmoothProgress(0);
      }
    }
  };

  const stageTitle =
    submissionPhase === SUBMISSION_STAGE.COMPLETED
      ? STAGE_LABELS[SUBMISSION_STAGE.COMPLETED]
      : STAGE_LABELS[submissionPhase] || STAGE_LABELS[SUBMISSION_STAGE.PREPARING];

  const narrativeLines =
    submissionPhase === SUBMISSION_STAGE.UPLOADING
      ? UPLOAD_NARRATIVES
      : submissionPhase === SUBMISSION_STAGE.FINALIZING
        ? FINALIZING_NARRATIVES
        : PROCESSING_NARRATIVES;
  const narrativeLine =
    submissionPhase === SUBMISSION_STAGE.PREPARING
      ? "Validating details and preparing your submission…"
      : submissionPhase === SUBMISSION_STAGE.COMPLETED
        ? ""
        : narrativeLines[narrativeIndex % narrativeLines.length];

  const redirectSubtitle = isAdmin
    ? "Redirecting to Pending Review"
    : "Redirecting to your dashboard";

  const showOverlay = loadingCreate || showCompletionCard;

  if (loading || roleLoading) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <p className={styles.muted}>Loading create form...</p>
        </main>
      </div>
    );
  }

  if (!user) return null;

  if (!canCreateListings) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <h1 className={styles.title}>Create Listing</h1>
          <AgentAccessGate user={user} />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <Breadcrumbs />
        <BackButton label="Back to Browse" />
        <h1 className={styles.title}>Create Listing</h1>
        {success && !showOverlay ? (
          <div className={styles.successBanner}>
            <span className={styles.successIcon}>✓</span> Listing Submitted Successfully
          </div>
        ) : null}

        {showOverlay ? (
          <div
            className={`${styles.submissionOverlay} ${overlayExiting ? styles.submissionOverlayExiting : ""}`}
            role="dialog"
            aria-busy={submissionPhase !== SUBMISSION_STAGE.COMPLETED}
            aria-live="polite"
          >
            <div className={styles.submissionCard}>
              <div className={styles.submissionSwirlWrap}>
                {submissionPhase === SUBMISSION_STAGE.COMPLETED ? (
                  <div className={styles.submissionSwirlCompleted} aria-hidden>
                    ✓
                  </div>
                ) : (
                  <div className={styles.submissionSwirl} aria-hidden />
                )}
              </div>

              {submissionPhase === SUBMISSION_STAGE.COMPLETED ? (
                <>
                  <p className={styles.submissionCompletedTitle}>Listing Submitted Successfully</p>
                  <p className={styles.submissionCompletedHint}>{redirectSubtitle}</p>
                </>
              ) : (
                <>
                  <h2 className={styles.submissionStageTitle}>{stageTitle}</h2>
                  <p
                    className={`${styles.submissionNarrative} ${narrativeFade ? styles.submissionNarrativeFade : ""}`}
                  >
                    {narrativeLine}
                  </p>
                </>
              )}

              <div className={styles.submissionProgressTrack}>
                <div
                  className={styles.submissionProgressFill}
                  style={{
                    width: `${clamp(Math.round(smoothProgress * 10) / 10, 0, 100)}%`,
                  }}
                />
              </div>
              <div className={styles.submissionPctLabel}>
                {Math.round(clamp(smoothProgress, 0, 100))}%
              </div>
            </div>
          </div>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit} autoComplete="off" data-lpignore="true">
          <input type="text" name="fake-field" autoComplete="off" style={{ display: "none" }} />
          <input
            className={styles.input}
            placeholder="Title"
            value={form.title}
            onChange={setField("title")}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {errors.title ? <p className={styles.inputError}>{errors.title}</p> : null}
          <input
            className={styles.input}
            placeholder="Price"
            value={form.price}
            onChange={setField("price")}
            autoComplete="off"
            inputMode="numeric"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {prefilledFields.price ? <p className={styles.muted}>Prefilled from Unit</p> : null}
          {errors.price ? <p className={styles.inputError}>{errors.price}</p> : null}
          <select className={styles.select} value={form.property_type} onChange={setField("property_type")} autoComplete="off">
            <option value="">Select property type</option>
            {PROPERTY_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {prefilledFields.property_type ? <p className={styles.muted}>Prefilled from Unit</p> : null}
          {errors.property_type ? <p className={styles.inputError}>{errors.property_type}</p> : null}
          <select className={styles.select} value={form.district} onChange={setField("district")} autoComplete="off">
            <option value="">Select region</option>
            {DISTRICTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {prefilledFields.district ? <p className={styles.muted}>Prefilled from Unit</p> : null}
          {errors.district ? <p className={styles.inputError}>{errors.district}</p> : null}
          <select className={styles.select} value={form.listing_type} onChange={setField("listing_type")} autoComplete="off">
            <option value="sale">sale</option>
            <option value="rent">rent</option>
          </select>
          {prefilledFields.listing_type ? <p className={styles.muted}>Prefilled from Unit</p> : null}
          <input
            className={styles.input}
            placeholder="Beds"
            value={form.beds}
            onChange={setField("beds")}
            autoComplete="off"
            inputMode="numeric"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <input
            className={styles.input}
            placeholder="Baths"
            value={form.baths}
            onChange={setField("baths")}
            autoComplete="off"
            inputMode="numeric"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <input
            className={styles.input}
            type="file"
            multiple
            accept="image/*"
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className={`${styles.primaryButton} ${loadingCreate ? styles.primaryButtonSubmitting : ""}`}
            disabled={loadingCreate || showCompletionCard}
            aria-busy={loadingCreate && !showCompletionCard}
          >
            {showCompletionCard
              ? "Submitted ✓"
              : loadingCreate
                ? "Submitting…"
                : success
                  ? "Created ✓"
                  : "Create Listing"}
          </button>
          {feedback ? <p className={styles.muted}>{feedback}</p> : null}
        </form>
        {isDebug && (
          <div
            style={{
              marginTop: "40px",
              padding: "20px",
              background: "#0B0F14",
              border: "1px solid #2A2F36",
              borderRadius: "12px",
              fontSize: "12px",
              maxHeight: "300px",
              overflow: "auto",
            }}
          >
            <h3>SYSTEM DEBUG</h3>
            <pre>{JSON.stringify(debugState, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}
