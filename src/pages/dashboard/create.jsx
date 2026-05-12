import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createDebugger } from "@/lib/debug";
import SiteNav from "../../components/SiteNav";
import BackButton from "../../components/BackButton";
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
import { AGENT_FREE_ACTIVE_LISTING_CAP, LISTING_LIFECYCLE, PLATFORM_TIERS } from "../../constants/operationalModel";
import { uploadListingImageFiles, persistListingImageOrder, safeFileSlug } from "../../lib/createListingUploads";
import {
  LISTING_MUTATION_FLOW,
  LISTING_MUTATION_OPERATION,
  logListingMutationFailureGrouped,
} from "../../lib/listingMutationDiagnostics";
import {
  sanitizeListingMutationPayload,
} from "../../lib/listingPayloadSanitize";
import {
  buildCreateListingPayload,
  buildDraftAutosavePayload,
  buildDraftListingPayload,
  getUserActiveListingCount,
  safeInsertListing,
  submitDraftListingForReview,
} from "../../lib/listingPersistence";
import { getLifecycleStatus } from "../../utils/canonicalListing";
import {
  CREATE_FORM_INITIAL,
  createSyntheticListingForPreview,
  mapListingRowToCreateForm,
} from "../../utils/createListingForm";
import { evaluateListingIntel } from "../../utils/listingIntel";
import { isLandInventoryListing } from "../../utils/listingPresentation";
import useFavorites from "../../hooks/useFavorites";
import { useFavoriteSignupPrompt } from "../../components/FavoriteSignupPromptProvider";
import CreateListingAmenitiesSelector from "../../components/CreateListingAmenitiesSelector";
import styles from "../../styles/Dashboard.module.css";
import cw from "../../styles/CreateWorkspace.module.css";

const HomePropertyCard = dynamic(() => import("@/components/HomePropertyCard"), { ssr: false });

const PROPERTY_TYPES = ["house", "apartment", "condo", "land", "commercial"];
const DISTRICTS = getSelectableRegions().map((region) => region.label);

const WORK_STAGES = [
  { id: 1, label: "Property basics" },
  { id: 2, label: "Property details" },
  { id: 3, label: "Media studio" },
  { id: 4, label: "Preview & health" },
  { id: 5, label: "Submit for review" },
];

const SUBMISSION_STAGE = {
  PREPARING: "preparing",
  UPLOADING: "uploading",
  PROCESSING: "processing",
  FINALIZING: "finalizing",
  COMPLETED: "completed",
};

const STAGE_LABELS = {
  [SUBMISSION_STAGE.PREPARING]: "Preparing your listing",
  [SUBMISSION_STAGE.UPLOADING]: "Syncing media",
  [SUBMISSION_STAGE.PROCESSING]: "Finalizing inventory",
  [SUBMISSION_STAGE.FINALIZING]: "Sending for review",
  [SUBMISSION_STAGE.COMPLETED]: "Completed",
};

const PROCESSING_NARRATIVES = [
  "Polishing details for the moderation queue",
  "Aligning inventory with BelizeListings visibility rules",
  "Almost there — calm handoff to review",
];

const UPLOAD_NARRATIVES = [
  "Securely transferring your images",
  "Optimizing media for a confident first impression",
  "Your listing stays private until approval",
];

const FINALIZING_NARRATIVES = [
  "Sealing the submission envelope",
  "Queueing for calm operational review",
  "Wrapping with lifecycle clarity",
];

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

function makeUploadKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `u-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formHasMeaningfulContent(form, pendingCount) {
  if (pendingCount > 0) return true;
  const amenityCount = Array.isArray(form.amenities) ? form.amenities.length : 0;
  return Boolean(
    String(form.title || "").trim() ||
      String(form.price || "").trim() ||
      String(form.description || "").trim() ||
      String(form.district || "").trim() ||
      String(form.property_type || "").trim() ||
      amenityCount > 0
  );
}

function optionalSquareFeet(form) {
  const r = String(form.square_feet || "").trim();
  if (!r) return null;
  const n = Number(r);
  return Number.isNaN(n) ? null : n;
}

export default function DashboardCreatePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { roleLoading, canCreateListings, tier, isAdmin } = useRoleAccess(user?.id);
  const { isFavorite, toggleFavorite, isBusy, isAuthenticated } = useFavorites();
  const openFavoriteSignupPrompt = useFavoriteSignupPrompt();
  const [form, setForm] = useState(() => ({ ...CREATE_FORM_INITIAL }));
  const [workspaceStage, setWorkspaceStage] = useState(1);
  const [draftListingId, setDraftListingId] = useState("");
  const [remoteImages, setRemoteImages] = useState([]);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [hydratingDraft, setHydratingDraft] = useState(false);
  const [saveUi, setSaveUi] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const [loadingCreate, setLoadingCreate] = useState(false);
  const [success, setSuccess] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errors, setErrors] = useState({});
  const debugRef = useRef(createDebugger("CREATE_FLOW"));
  const prefillAppliedRef = useRef(false);
  const [debugState, setDebugState] = useState({});
  const { showToast } = useToast();
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
  const [dropActive, setDropActive] = useState(false);
  const [previewCarouselIndex, setPreviewCarouselIndex] = useState(0);
  const mediaPickId = useId();
  const [mediaStudioBusy, setMediaStudioBusy] = useState({
    active: false,
    phase: "idle",
    done: 0,
    total: 0,
  });

  const targetProgressRef = useRef(0);
  const visualProgressRef = useRef(0);
  const progressRafRef = useRef(null);
  const lastProgressPaintRef = useRef(0);
  const allowNextNavRef = useRef(false);
  /** Suppresses route-leave confirm while attaching `?draft=` after first insert. */
  const draftUrlSyncRef = useRef(false);
  const saveInFlight = useRef(false);
  /** Prevents double-submit while autosave + auth + network run (state alone can lag one frame). */
  const submitInFlight = useRef(false);
  /** Limits console noise when saves fail repeatedly (e.g. schema mismatch). */
  const saveFailureLogAtRef = useRef(0);
  /** Limits stacked error toasts when the user retries quickly. */
  const saveFailureToastAtRef = useRef(0);

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
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const setField = (field) => (event) => {
    setErrors((current) => ({ ...current, [field]: "" }));
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setDirty(true);
  };

  /** Beds/baths: empty and "0" both show placeholder; no leading zeros. */
  const setRoomCountField = (field) => (event) => {
    const raw = String(event.target.value ?? "");
    const digits = raw.replace(/[^\d]/g, "");
    let next = digits.replace(/^0+/, "");
    if (next === "0") next = "";
    setErrors((current) => ({ ...current, [field]: "" }));
    setForm((current) => ({ ...current, [field]: next }));
    setDirty(true);
  };

  const queryDraftId = useMemo(() => {
    const q = router.query?.draft;
    return q ? String(Array.isArray(q) ? q[0] : q) : "";
  }, [router.query?.draft]);

  useEffect(() => {
    if (!router.isReady || prefillAppliedRef.current) return;
    const prefillPrice = String(qv(router.query.price) || "");
    const prefillDistrict = districtForSelect(qv(router.query.district));
    const prefillPropertyType = String(qv(router.query.property_type) || "").toLowerCase();
    const prefillListingType = String(qv(router.query.listing_type) || "").toLowerCase();
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
    setLinkedUnitId(prefillUnitId);
    prefillAppliedRef.current = true;
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (
      !isLandInventoryListing({
        property_type: form.property_type,
        listing_type: form.listing_type,
        market_type: form.market_type,
        category: form.category,
      })
    )
      return;
    setForm((prev) => {
      if (prev.beds === "" && prev.baths === "") return prev;
      return { ...prev, beds: "", baths: "" };
    });
  }, [form.property_type, form.listing_type, form.market_type, form.category]);

  useEffect(() => {
    if (!router.isReady || !queryDraftId || !user?.id) return undefined;
    let cancelled = false;
    setHydratingDraft(true);
    (async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, listing_images(*)")
        .eq("id", queryDraftId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setHydratingDraft(false);
        showToast({ type: "error", message: "Could not load this draft." });
        return;
      }
      if (String(data.user_id) !== String(user.id)) {
        setHydratingDraft(false);
        showToast({ type: "error", message: "This draft belongs to another account." });
        return;
      }
      if (getLifecycleStatus(data) !== LISTING_LIFECYCLE.DRAFT) {
        setHydratingDraft(false);
        showToast({ type: "info", message: "This listing is no longer a draft — open it from your dashboard." });
        return;
      }
      setForm(mapListingRowToCreateForm(data));
      setDraftListingId(String(data.id));
      const imgs = (data.listing_images || [])
        .filter(Boolean)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      setRemoteImages(imgs);
      setDirty(false);
      setHydratingDraft(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, queryDraftId, user?.id, showToast]);

  const refetchRemoteImages = useCallback(
    async (listingId) => {
      const { data } = await supabase
        .from("listing_images")
        .select("*")
        .eq("listing_id", listingId)
        .order("position", { ascending: true });
      const rows = (data || []).filter(Boolean).map((row) => ({ ...row }));
      setRemoteImages(rows);
    },
    []
  );

  const runAutosave = useCallback(async (opts = {}) => {
    const mutationFlow = opts.mutationFlow ?? LISTING_MUTATION_FLOW.DRAFT_AUTOSAVE;
    if (!user?.id || !canCreateListings) {
      return { success: true, skipped: true, listingId: draftListingId || null };
    }
    if (saveInFlight.current) {
      return { success: false, skipped: false, listingId: draftListingId || null };
    }
    if (!formHasMeaningfulContent(form, pendingUploads.length) && !draftListingId) {
      return { success: true, skipped: true, listingId: null };
    }

    saveInFlight.current = true;
    setSaveUi("saving");
    let activeId = draftListingId;

    try {
      if (!activeId) {
        const payload = buildDraftListingPayload({
          form,
          authUserId: user.id,
          linkedUnitId,
        });
        const insertResult = await safeInsertListing(supabase, payload, { mutationFlow });
        if (insertResult.error || !insertResult.data?.id) throw insertResult.error || new Error("Draft save failed");
        activeId = String(insertResult.data.id);
        setDraftListingId(activeId);
        draftUrlSyncRef.current = true;
        try {
          await router.replace(
            { pathname: router.pathname, query: { ...router.query, draft: activeId } },
            undefined,
            { shallow: true }
          );
        } finally {
          draftUrlSyncRef.current = false;
        }
      } else {
        const payload = sanitizeListingMutationPayload(
          buildDraftAutosavePayload({
            form,
            authUserId: user.id,
            linkedUnitId,
          }),
          {
            mutationFlow,
            operation: LISTING_MUTATION_OPERATION.PATCH,
          }
        );
        const { error: upErr } = await supabase
          .from("listings")
          .update(payload)
          .eq("id", activeId)
          .eq("user_id", user.id);
        if (upErr) {
          logListingMutationFailureGrouped({
            operation: LISTING_MUTATION_OPERATION.PATCH,
            mutationFlow,
            stage: "draft-autosave-patch",
            attempt: 1,
            retryMax: 1,
            strippedKeys: [],
            payload,
            error: upErr,
          });
          throw upErr;
        }
      }

      if (pendingUploads.length > 0 && activeId) {
        const filesOnly = pendingUploads.map((p) => p.file);
        const startPos = remoteImages.length;
        const totalFiles = filesOnly.length;
        setMediaStudioBusy({ active: true, phase: "optimizing", done: 0, total: totalFiles });
        await new Promise((r) => {
          requestAnimationFrame(() => r());
        });
        try {
          setMediaStudioBusy((s) => ({ ...s, phase: "uploading", done: 0, total: totalFiles }));
          const { failures } = await uploadListingImageFiles(supabase, {
            listingId: activeId,
            userId: user.id,
            files: filesOnly,
            startPosition: startPos,
            onProgress: (done, total) => {
              setMediaStudioBusy((prev) => ({
                ...prev,
                active: true,
                phase: "uploading",
                done,
                total,
              }));
            },
          });
          const allFailed = failures.length > 0 && failures.length >= totalFiles;
          if (failures.length) {
            showToast({
              type: "info",
              message: allFailed
                ? "No images uploaded — check your connection and try Save draft again."
                : `${failures.length} of ${totalFiles} image(s) did not upload — you can retry with Save draft.`,
            });
          }
          if (!allFailed) {
            setMediaStudioBusy((s) => ({ ...s, phase: "syncing", done: totalFiles, total: totalFiles }));
            await refetchRemoteImages(activeId);
            setPendingUploads((prev) => {
              prev.forEach((p) => {
                if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
              });
              return [];
            });
          }
        } finally {
          setMediaStudioBusy({ active: false, phase: "idle", done: 0, total: 0 });
        }
      }

      try {
        localStorage.setItem(
          `bl_ws_${user.id}_${activeId}`,
          JSON.stringify({ form, savedAt: Date.now(), listingId: activeId })
        );
      } catch {
        /* ignore quota */
      }

      setSaveUi("saved");
      setLastSavedAt(Date.now());
      setDirty(false);
      saveFailureToastAtRef.current = 0;
      saveFailureLogAtRef.current = 0;
      return { success: true, skipped: false, listingId: activeId };
    } catch (e) {
      const now = Date.now();
      if (now - saveFailureLogAtRef.current > 8000) {
        saveFailureLogAtRef.current = now;
        console.warn("[create-workspace] save failed", e?.message ?? e);
      }
      setSaveUi("error");
      try {
        localStorage.setItem(
          `bl_ws_fb_${user.id}`,
          JSON.stringify({ form, draftListingId: activeId || "", at: Date.now() })
        );
      } catch {
        /* ignore */
      }
      return { success: false, skipped: false, listingId: activeId || null };
    } finally {
      saveInFlight.current = false;
    }
  }, [
    user?.id,
    canCreateListings,
    form,
    pendingUploads,
    draftListingId,
    linkedUnitId,
    router,
    remoteImages.length,
    refetchRemoteImages,
    showToast,
  ]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const onRoute = (url) => {
      if (allowNextNavRef.current || draftUrlSyncRef.current) return;
      if (!dirtyRef.current) return;
      const ok = window.confirm("Leave this workspace? Unsaved changes may not be synced yet.");
      if (!ok) {
        router.events.emit("routeChangeError");
        throw new Error("Route change aborted");
      }
    };
    router.events.on("routeChangeStart", onRoute);
    return () => router.events.off("routeChangeStart", onRoute);
  }, [router]);

  const handleSaveDraft = useCallback(async () => {
    if (!canCreateListings || hydratingDraft) return;
    const result = await runAutosave({ mutationFlow: LISTING_MUTATION_FLOW.DRAFT_AUTOSAVE });
    if (!result.success) {
      const t = Date.now();
      if (t - saveFailureToastAtRef.current > 4000) {
        saveFailureToastAtRef.current = t;
        showToast({
          type: "error",
          message: "Unable to save changes right now. You can keep editing — try Save draft again shortly.",
        });
      }
      return;
    }
    if (result.skipped) {
      showToast({
        type: "info",
        message: "Add a title, price, or region to create a draft on the server.",
      });
    } else {
      showToast({ type: "success", message: "Draft saved" });
    }
  }, [canCreateListings, hydratingDraft, runAutosave, showToast]);

  const handleContinue = useCallback(async () => {
    if (hydratingDraft || workspaceStage >= 5) return;
    const result = await runAutosave({ mutationFlow: LISTING_MUTATION_FLOW.CONTINUE });
    if (!result.success) {
      const t = Date.now();
      if (t - saveFailureToastAtRef.current > 4000) {
        saveFailureToastAtRef.current = t;
        showToast({
          type: "error",
          message: "Draft not synced — stay on this step, then try Save draft.",
        });
      }
      return;
    }
    setWorkspaceStage((s) => Math.min(5, s + 1));
  }, [hydratingDraft, workspaceStage, runAutosave, showToast]);

  const handleBack = useCallback(async () => {
    if (hydratingDraft || workspaceStage <= 1) return;
    const result = await runAutosave({ mutationFlow: LISTING_MUTATION_FLOW.DRAFT_AUTOSAVE });
    if (!result.success) {
      showToast({ type: "error", message: "Could not save — stay on this step until the draft saves." });
      return;
    }
    setWorkspaceStage((s) => Math.max(1, s - 1));
  }, [hydratingDraft, workspaceStage, runAutosave, showToast]);

  useEffect(() => {
    const overlayActive = loadingCreate || showCompletionCard;
    if (!overlayActive) {
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
      visualProgressRef.current = 0;
      targetProgressRef.current = 0;
      setSmoothProgress(0);
      return undefined;
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

  const mergeFilesIntoPending = useCallback((fileList) => {
    const incoming = Array.from(fileList || []).filter(Boolean);
    if (!incoming.length) return;
    setPendingUploads((prev) => {
      const next = [...prev];
      const sigs = new Set(
        prev.map((p) => `${p.file.name}:${p.file.size}`).concat(
          remoteImages.map((r) => String(r.image_url || ""))
        )
      );
      for (const file of incoming) {
        const sig = `${file.name}:${file.size}`;
        if (sigs.has(sig)) continue;
        sigs.add(sig);
        next.push({
          key: makeUploadKey(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
      return next;
    });
    setDirty(true);
  }, [remoteImages]);

  const removePendingAt = useCallback((key) => {
    setPendingUploads((prev) => {
      const hit = prev.find((p) => p.key === key);
      if (hit?.previewUrl) URL.revokeObjectURL(hit.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
    setDirty(true);
  }, []);

  const removeRemoteAt = useCallback(
    async (row) => {
      if (!row?.id) return;
      const { error } = await supabase.from("listing_images").delete().eq("id", row.id);
      if (error) {
        showToast({ type: "error", message: "Could not remove image" });
        return;
      }
      if (draftListingId) await refetchRemoteImages(draftListingId);
      setDirty(true);
    },
    [draftListingId, refetchRemoteImages, showToast]
  );

  const moveRemote = useCallback(
    async (from, to) => {
      if (to < 0 || to >= remoteImages.length) return;
      const next = [...remoteImages];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      setRemoteImages(next);
      const { error } = await persistListingImageOrder(supabase, next);
      if (error) {
        showToast({ type: "error", message: "Could not reorder images" });
        if (draftListingId) await refetchRemoteImages(draftListingId);
        return;
      }
      setDirty(true);
    },
    [remoteImages, draftListingId, refetchRemoteImages, showToast]
  );

  const validateSubmit = useCallback(() => {
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
    return {
      ok: Object.keys(nextErrors).length === 0,
      errors: nextErrors,
      snapshot: { title, district, property_type, price, beds, baths },
    };
  }, [form]);

  const finishSubmissionOverlay = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 2000));
    setOverlayExiting(true);
    await new Promise((r) => setTimeout(r, 480));
    allowNextNavRef.current = true;
    router.push(isAdmin ? "/admin?tab=pending" : "/dashboard/agent");
  }, [router, isAdmin]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loadingCreate || hydratingDraft || submitInFlight.current) return;
    const v = validateSubmit();
    setErrors(v.errors);
    if (!v.ok) {
      setFeedback("Please fix the highlighted fields.");
      setWorkspaceStage(1);
      return;
    }

    let createSucceeded = false;
    submitInFlight.current = true;
    try {
      let effectiveDraftId = draftListingId;
      if (dirty || pendingUploads.length > 0) {
        const flushed = await runAutosave({ mutationFlow: LISTING_MUTATION_FLOW.SUBMIT });
        if (!flushed.success) {
          showToast({
            type: "error",
            message: "Unable to save before submit. Use Save draft, then try again.",
          });
          submitInFlight.current = false;
          return;
        }
        if (flushed.listingId) effectiveDraftId = flushed.listingId;
      }

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
      debugRef.current.log("USER", authUser);
      setDebugState(debugRef.current.getState());

      if (!authUser?.id) {
        setFeedback("User not authenticated");
        showToast({ type: "error", message: "Please sign in again" });
        return;
      }

      setProgressTarget(14);

      const activeCount = await getUserActiveListingCount(supabase, authUser.id);
      if (tier === PLATFORM_TIERS.AGENT_FREE && activeCount >= AGENT_FREE_ACTIVE_LISTING_CAP) {
        throw new Error(
          `Free Agent tier limit reached (${AGENT_FREE_ACTIVE_LISTING_CAP} active listings).`
        );
      }

      const formSnap = {
        ...form,
        title: v.snapshot.title,
        district: v.snapshot.district,
        property_type: v.snapshot.property_type,
        price: v.snapshot.price,
        beds: v.snapshot.beds,
        baths: v.snapshot.baths,
        square_feet: optionalSquareFeet(form),
      };

      const uploadCombinedFiles = pendingUploads.map((p) => p.file).filter(Boolean);

      if (effectiveDraftId) {
        setSubmissionPhase(SUBMISSION_STAGE.PROCESSING);
        setProgressTarget(22);
        const submitResult = await submitDraftListingForReview(supabase, {
          listingId: effectiveDraftId,
          form: formSnap,
          authUserId: authUser.id,
          linkedUnitId,
        });
        if (submitResult.error) throw submitResult.error;

        traceAction({
          type: "submit_draft_listing",
          payload: { listingId: effectiveDraftId },
        });

        setProgressTarget(42);

        if (linkedUnitId) {
          setProgressTarget(46);
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

        const nFiles = uploadCombinedFiles.length;
        let imagePositionStart = 0;
        if (nFiles > 0) {
          const { count } = await supabase
            .from("listing_images")
            .select("id", { count: "exact", head: true })
            .eq("listing_id", effectiveDraftId);
          imagePositionStart = Number(count || 0);
          setSubmissionPhase(SUBMISSION_STAGE.UPLOADING);
          setNarrativeIndex(0);
          setProgressTarget(50);
        } else {
          setProgressTarget(72);
        }

        const uploadFailures = [];
        for (let i = 0; i < uploadCombinedFiles.length; i++) {
          const file = uploadCombinedFiles[i];
          if (!file) continue;
          const span = 28;
          const base = 50;
          setProgressTarget(base + ((i + 0.35) / Math.max(nFiles, 1)) * span);
          try {
            const fileName = safeFileSlug(file.name);
            const filePath = `${authUser.id}/${Date.now()}-${i}-${fileName}`;
            const { error: uploadError } = await supabase.storage
              .from("listing-images")
              .upload(filePath, file, {
                upsert: false,
                contentType: file.type || undefined,
              });
            if (uploadError) throw uploadError;
            setProgressTarget(base + ((i + 0.72) / Math.max(nFiles, 1)) * span);
            const { data: publicUrlData } = supabase.storage.from("listing-images").getPublicUrl(filePath);
            const publicUrl = publicUrlData?.publicUrl;
            if (publicUrl) {
              const { error: imageError } = await supabase.from("listing_images").insert({
                listing_id: effectiveDraftId,
                image_url: publicUrl,
                position: imagePositionStart + i,
              });
              if (imageError) throw imageError;
            }
            setProgressTarget(base + ((i + 1) / Math.max(nFiles, 1)) * span);
          } catch (uploadErr) {
            uploadFailures.push(file?.name || `image-${i + 1}`);
          }
        }

        if (uploadFailures.length) {
          showToast({
            type: "info",
            message: `Submitted for review — ${uploadFailures.length} image upload(s) need retry from your dashboard.`,
          });
        }

        setSubmissionPhase(SUBMISSION_STAGE.FINALIZING);
        setNarrativeIndex(0);
        setProgressTarget(92);
        await new Promise((r) => setTimeout(r, 380));
        setProgressTarget(97);
        setSubmissionPhase(SUBMISSION_STAGE.COMPLETED);
        setShowCompletionCard(true);
        setProgressTarget(100);
        createSucceeded = true;
        setLoadingCreate(false);
        setSuccess(true);
        showToast({ type: "success", message: "Listing submitted for approval" });
        try {
          localStorage.removeItem(`bl_ws_${authUser.id}_${effectiveDraftId}`);
          localStorage.removeItem(`bl_ws_fb_${authUser.id}`);
        } catch {
          /* ignore */
        }
        await finishSubmissionOverlay();
        return;
      }

      const payload = buildCreateListingPayload({
        form: formSnap,
        authUserId: authUser.id,
        linkedUnitId,
      });
      traceLog("INSERT PAYLOAD:", payload);
      traceAction({ type: "create_listing", payload });
      debugRef.current.log("LISTING_PAYLOAD", payload);

      setSubmissionPhase(SUBMISSION_STAGE.PROCESSING);
      setProgressTarget(28);
      setNarrativeIndex(0);

      const insertResult = await safeInsertListing(supabase, payload, {
        mutationFlow: LISTING_MUTATION_FLOW.SUBMIT,
      });
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
      const nFiles = uploadCombinedFiles.length;

      if (nFiles > 0) {
        setSubmissionPhase(SUBMISSION_STAGE.UPLOADING);
        setNarrativeIndex(0);
        setProgressTarget(54);
      } else {
        setProgressTarget(72);
      }

      const uploadFailures = [];
      for (let i = 0; i < uploadCombinedFiles.length; i++) {
        const file = uploadCombinedFiles[i];
        if (!file) continue;
        const fileName = safeFileSlug(file.name);
        const filePath = `${authUser.id}/${Date.now()}-${i}-${fileName}`;
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
          console.error("[create-listing] image upload failed", uploadErr);
          uploadFailures.push(file?.name || `image-${i + 1}`);
        }
      }

      if (uploadFailures.length) {
        showToast({
          type: "info",
          message: `Listing created, but ${uploadFailures.length} image upload(s) failed.`,
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
      try {
        localStorage.removeItem(`bl_ws_fb_${authUser.id}`);
      } catch {
        /* ignore */
      }

      await finishSubmissionOverlay();
    } catch (createError) {
      console.error("CREATE ERROR:", createError);
      setFeedback(createError?.message || "Failed to create listing");
      showToast({ type: "error", message: createError?.message || "Failed to create listing" });
    } finally {
      submitInFlight.current = false;
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
      ? "Gathering details and preparing a calm handoff…"
      : submissionPhase === SUBMISSION_STAGE.COMPLETED
        ? ""
        : narrativeLines[narrativeIndex % narrativeLines.length];

  const redirectSubtitle = isAdmin ? "Redirecting to Pending Review" : "Redirecting to your dashboard";

  const showOverlay = loadingCreate || showCompletionCard;

  const persistedPreviewListingId = String(draftListingId || "").trim();

  const syntheticListing = useMemo(
    () =>
      createSyntheticListingForPreview(
        form,
        remoteImages,
        pendingUploads.map((p) => p.previewUrl).filter(Boolean),
        persistedPreviewListingId || undefined
      ),
    [form, remoteImages, pendingUploads, persistedPreviewListingId]
  );

  const previewImageCount = Array.isArray(syntheticListing?.images) ? syntheticListing.images.length : 0;
  const previewFabReady = Boolean(persistedPreviewListingId);

  useEffect(() => {
    setPreviewCarouselIndex(0);
  }, [previewImageCount, persistedPreviewListingId]);

  const intel = useMemo(() => evaluateListingIntel(syntheticListing), [syntheticListing]);

  const landPresentationMode = useMemo(
    () =>
      isLandInventoryListing({
        property_type: form.property_type,
        listing_type: form.listing_type,
        market_type: form.market_type,
        category: form.category,
      }),
    [form.property_type, form.listing_type, form.market_type, form.category]
  );

  const saveLabel =
    saveUi === "saving"
      ? "Saving draft…"
      : saveUi === "saved"
        ? "Changes saved"
        : saveUi === "error"
          ? "Draft not synced"
          : "Ready";

  const lastSavedLabel =
    lastSavedAt != null
      ? `Last saved ${Math.max(0, Math.round((Date.now() - lastSavedAt) / 60000))}m ago`
      : null;

  if (loading || roleLoading) {
    return (
      <div className={`${styles.page} ${cw.pageShell}`}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <p className={styles.muted}>Loading workspace…</p>
        </main>
      </div>
    );
  }

  if (!user) return null;

  if (!canCreateListings) {
    return (
      <div className={`${styles.page} ${cw.pageShell}`}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <h1 className={styles.title}>Create Listing</h1>
          <AgentAccessGate user={user} />
        </main>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${cw.pageShell}`}>
      <div className={cw.workspaceGlow} aria-hidden />
      <SiteNav active="dashboard" />
      <main className={`${styles.main} ${cw.workspaceInner} ${cw.workspaceMain}`}>
        <div className={cw.workspace}>
          <div className={cw.workspaceNav}>
            <BackButton label="Back" className={cw.backButton} />
          </div>
          <div className={cw.workspaceHeader}>
            <h1 className={cw.heroTitle}>Create inventory</h1>
            <div className={cw.saveRail}>
              <div
                className={`${cw.savePill} ${
                  saveUi === "saving"
                    ? cw.savePillSaving
                    : saveUi === "saved"
                      ? cw.savePillSaved
                      : saveUi === "error"
                        ? cw.savePillError
                        : ""
                }`}
                role="status"
                aria-live="polite"
              >
                {saveLabel}
                {lastSavedLabel ? (
                  <span className={cw.savePillMuted}> · {lastSavedLabel}</span>
                ) : null}
              </div>
              {draftListingId ? (
                <span className={`${styles.muted} ${cw.metaInline}`}>
                  Draft ID {draftListingId.slice(0, 8)}…
                </span>
              ) : null}
            </div>
          </div>

          {success && !showOverlay ? (
            <div className={styles.successBanner}>
              <span className={styles.successIcon}>✓</span> Listing Submitted Successfully
            </div>
          ) : null}

          {showOverlay ? (
            <div
              className={`${cw.submissionOverlay} ${overlayExiting ? cw.submissionOverlayExiting : ""}`}
              role="dialog"
              aria-busy={submissionPhase !== SUBMISSION_STAGE.COMPLETED}
              aria-live="polite"
            >
              <div className={cw.submissionBackdropWash} aria-hidden />
              <div className={cw.submissionDriftA} aria-hidden />
              <div className={cw.submissionDriftB} aria-hidden />
              <div className={cw.submissionDriftC} aria-hidden />
              <div className={cw.submissionCard}>
                <div className={cw.submissionSwirlWrap}>
                  {submissionPhase === SUBMISSION_STAGE.COMPLETED ? (
                    <div className={cw.submissionSwirlCompleted} aria-hidden>
                      ✓
                    </div>
                  ) : (
                    <div className={cw.submissionSwirl} aria-hidden />
                  )}
                </div>

                {submissionPhase === SUBMISSION_STAGE.COMPLETED ? (
                  <>
                    <p className={cw.submissionCompletedTitle}>Listing submitted</p>
                    <p className={cw.submissionCompletedHint}>{redirectSubtitle}</p>
                  </>
                ) : (
                  <>
                    <h2 className={cw.submissionStageTitle}>{stageTitle}</h2>
                    <p
                      className={`${cw.submissionNarrative} ${narrativeFade ? cw.submissionNarrativeFade : ""}`}
                    >
                      {narrativeLine}
                    </p>
                  </>
                )}

                <div className={cw.submissionProgressTrack}>
                  <div
                    className={cw.submissionProgressFill}
                    style={{
                      width: `${clamp(Math.round(smoothProgress * 10) / 10, 0, 100)}%`,
                    }}
                  />
                </div>
                <div className={cw.submissionPctLabel}>{Math.round(clamp(smoothProgress, 0, 100))}%</div>
              </div>
            </div>
          ) : null}

          <ol className={cw.stageNav} aria-label="Create listing progress">
            {WORK_STAGES.map((s) => {
              const done = workspaceStage > s.id;
              const active = workspaceStage === s.id;
              return (
                <li
                  key={s.id}
                  className={`${cw.stagePill} ${active ? cw.stagePillActive : ""} ${done ? cw.stagePillDone : ""}`}
                  aria-current={active ? "step" : undefined}
                >
                  <span className={cw.stagePillIndex} aria-hidden>
                    {done ? "✓" : s.id}
                  </span>
                  <span className={cw.stagePillLabel}>{s.label}</span>
                </li>
              );
            })}
          </ol>

          <form
            id="create-workspace-form"
            className={cw.createForm}
            onSubmit={(e) => {
              if (workspaceStage !== 5) {
                e.preventDefault();
                return;
              }
              void handleSubmit(e);
            }}
            autoComplete="off"
            data-lpignore="true"
          >
            <input type="text" name="fake-field" autoComplete="off" style={{ display: "none" }} />

            <div className={cw.workspaceActiveCard} key={workspaceStage}>
            <div className={cw.stageBody}>
            {workspaceStage === 1 ? (
              <section className={`${cw.glassSection} ${cw.stagePanel}`} aria-labelledby="ws-basics">
                <h2 className={cw.sectionLabel} id="ws-basics">
                  Property basics
                </h2>
                <div className={`${cw.fieldGrid} ${cw.two}`}>
                  <div>
                    <input
                      className={cw.input}
                      placeholder="Title"
                      value={form.title}
                      onChange={setField("title")}
                      autoComplete="off"
                      spellCheck
                    />
                    {errors.title ? <p className={cw.inputError}>{errors.title}</p> : null}
                  </div>
                  <div>
                    <input
                      className={cw.input}
                      placeholder="Price (BZD)"
                      value={form.price}
                      onChange={setField("price")}
                      inputMode="decimal"
                      autoComplete="off"
                    />
                    {prefilledFields.price ? <p className={styles.muted}>Prefilled from Unit</p> : null}
                    {errors.price ? <p className={cw.inputError}>{errors.price}</p> : null}
                  </div>
                  <div>
                    <select className={cw.select} value={form.property_type} onChange={setField("property_type")}>
                      <option value="">Property type</option>
                      {PROPERTY_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    {prefilledFields.property_type ? <p className={styles.muted}>Prefilled from Unit</p> : null}
                    {errors.property_type ? <p className={cw.inputError}>{errors.property_type}</p> : null}
                  </div>
                  <div>
                    <select className={cw.select} value={form.district} onChange={setField("district")}>
                      <option value="">Region</option>
                      {DISTRICTS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    {prefilledFields.district ? <p className={styles.muted}>Prefilled from Unit</p> : null}
                    {errors.district ? <p className={cw.inputError}>{errors.district}</p> : null}
                  </div>
                  <div>
                    <select className={cw.select} value={form.listing_type} onChange={setField("listing_type")}>
                      <option value="sale">For sale</option>
                      <option value="rent">For rent</option>
                    </select>
                  </div>
                </div>
              </section>
            ) : null}

            {workspaceStage === 2 ? (
              <section className={`${cw.glassSection} ${cw.stagePanel}`} aria-labelledby="ws-details">
                <h2 className={cw.sectionLabel} id="ws-details">
                  Property details
                </h2>
                <div className={`${cw.fieldGrid} ${landPresentationMode ? "" : cw.two}`}>
                  {!landPresentationMode ? (
                    <>
                      <input
                        className={cw.input}
                        placeholder="Beds"
                        value={form.beds}
                        onChange={setRoomCountField("beds")}
                        inputMode="numeric"
                        autoComplete="off"
                      />
                      <input
                        className={cw.input}
                        placeholder="Baths"
                        value={form.baths}
                        onChange={setRoomCountField("baths")}
                        inputMode="numeric"
                        autoComplete="off"
                      />
                    </>
                  ) : null}
                  <input
                    className={cw.input}
                    placeholder="Square feet (optional)"
                    value={form.square_feet}
                    onChange={setField("square_feet")}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <textarea
                  className={`${cw.textarea} ${cw.textareaCompact}`}
                  placeholder={
                    landPresentationMode
                      ? "Description — access, terrain, boundaries, and what makes this parcel distinct."
                      : "Description — highlight views, access, and what makes this property distinct."
                  }
                  value={form.description}
                  onChange={setField("description")}
                />
                {form.legacyFeaturesTail ? (
                  <p className={cw.legacyFeaturesNote}>
                    Imported detail (not matched to amenity chips) is preserved:{" "}
                    <span className={cw.legacyFeaturesEm}>{form.legacyFeaturesTail}</span>
                  </p>
                ) : null}
                <div className={cw.amenitiesSection} aria-labelledby="ws-amenities-label">
                  <p className={cw.amenitiesSectionLabel} id="ws-amenities-label">
                    Amenities
                  </p>
                  <CreateListingAmenitiesSelector
                    value={form.amenities}
                    onChange={(next) => {
                      setForm((prev) => ({ ...prev, amenities: next }));
                      setDirty(true);
                    }}
                    landPrioritize={landPresentationMode}
                  />
                </div>
              </section>
            ) : null}

            {workspaceStage === 3 ? (
              <section className={`${cw.glassSection} ${cw.stagePanel}`} aria-labelledby="ws-media">
                <h2 className={cw.sectionLabel} id="ws-media">
                  Media studio
                </h2>
                <label
                  htmlFor={mediaPickId}
                  className={`${cw.dropZone} ${dropActive ? cw.dropZoneDrag : ""}`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDropActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDragLeave={() => setDropActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropActive(false);
                    mergeFilesIntoPending(e.dataTransfer?.files);
                  }}
                >
                  <input
                    id={mediaPickId}
                    type="file"
                    multiple
                    accept="image/*"
                    className={cw.mediaPickInput}
                    onChange={(event) => mergeFilesIntoPending(event.target.files)}
                  />
                  <p className={cw.dropHint}>Drop photos here, or tap to browse</p>
                  <p className={cw.dropMuted}>First image becomes cover · reorder below · duplicates are skipped</p>
                </label>

                <div className={cw.mediaGrid}>
                  {remoteImages.map((img, idx) => (
                    <div key={img.id || img.image_url} className={cw.mediaThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.image_url} alt="" loading="lazy" decoding="async" />
                      {idx === 0 ? <span className={cw.coverBadge}>Cover</span> : null}
                      <div className={cw.mediaActions}>
                        <button
                          type="button"
                          className={cw.mediaBtn}
                          onClick={() => moveRemote(idx, idx - 1)}
                          disabled={idx === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={cw.mediaBtn}
                          onClick={() => moveRemote(idx, idx + 1)}
                          disabled={idx >= remoteImages.length - 1}
                        >
                          ↓
                        </button>
                        <button type="button" className={cw.mediaBtn} onClick={() => removeRemoteAt(img)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingUploads.map((p) => (
                    <div key={p.key} className={cw.mediaThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.previewUrl} alt="" />
                      <div className={cw.mediaActions}>
                        <button type="button" className={cw.mediaBtn} onClick={() => removePendingAt(p.key)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {workspaceStage === 4 ? (
              <section className={`${cw.glassSection} ${cw.stagePanel}`} aria-labelledby="ws-preview">
                <h2 className={cw.sectionLabel} id="ws-preview">
                  Preview & inventory health
                </h2>
                <div className={cw.previewGrid}>
                  <div className={cw.previewPane}>
                    <p className={cw.previewPaneTitle}>Listing preview (production card)</p>
                    {!previewFabReady ? (
                      <p className={cw.previewFabHint}>
                        Save a draft once to enable favorite and share on this preview — same chrome as live listings
                        (see <code className={cw.previewFabHintCode}>docs/BELIZELISTINGS_LISTING_CARD_DNA.md</code>).
                      </p>
                    ) : null}
                    <div className={cw.previewCardShell}>
                      <HomePropertyCard
                        listing={syntheticListing}
                        imagePriority={false}
                        disableNavigation
                        showFavoriteButton={previewFabReady}
                        showShareButton={previewFabReady}
                        isFavorited={previewFabReady ? isFavorite(syntheticListing.id) : false}
                        favoriteBusy={previewFabReady ? isBusy(syntheticListing.id) : false}
                        onFavoriteClick={(listingId) => {
                          if (!previewFabReady) return;
                          if (!isAuthenticated) {
                            openFavoriteSignupPrompt();
                            return;
                          }
                          void toggleFavorite(listingId);
                        }}
                        carouselIndex={previewCarouselIndex}
                        onCarouselIndexChange={setPreviewCarouselIndex}
                      />
                    </div>
                  </div>
                  <div className={cw.previewPane}>
                    <p className={cw.previewPaneTitle}>Guidance</p>
                    <div className={cw.previewGuidance} aria-live="polite" aria-relevant="additions text">
                      <ul className={cw.healthHints}>
                        {intel.warnings.slice(0, 8).map((w) => (
                          <li key={w.code}>{w.label}</li>
                        ))}
                        {intel.warnings.length === 0 ? (
                          <li>Looking balanced — add polish with more photos or detail.</li>
                        ) : null}
                      </ul>
                      <p className={cw.previewFoot}>
                        Health tier: <strong>{intel.healthTier}</strong> · score {intel.healthScore}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {workspaceStage === 5 ? (
              <section className={`${cw.glassSection} ${cw.stagePanel}`} aria-labelledby="ws-submit">
                <h2 className={cw.sectionLabel} id="ws-submit">
                  Submit for review
                </h2>
                <p className={cw.submissionHint}>
                  Submitting sends your listing to the moderation queue. It stays private until approved — then it can appear in
                  search, districts, and maps per BelizeListings visibility rules.
                </p>
                {feedback ? <p className={styles.muted}>{feedback}</p> : null}
              </section>
            ) : null}
            </div>

            <div className={cw.footerBar}>
              <div className={cw.footerLeft}>
                {workspaceStage > 1 ? (
                  <button
                    type="button"
                    className={cw.footerBack}
                    onClick={() => void handleBack()}
                    disabled={saveUi === "saving" || hydratingDraft || mediaStudioBusy.active}
                  >
                    Back
                  </button>
                ) : (
                  <span className={cw.footerBackPlaceholder} aria-hidden />
                )}
              </div>
              <div className={cw.footerActions}>
                <button
                  type="button"
                  className={cw.saveDraftBtn}
                  onClick={() => void handleSaveDraft()}
                  disabled={saveUi === "saving" || hydratingDraft || mediaStudioBusy.active}
                >
                  Save draft
                </button>
                {workspaceStage < 5 ? (
                  <button
                    type="button"
                    className={`${styles.primaryButton} ${cw.footerPrimaryCta}`}
                    onClick={() => void handleContinue()}
                    disabled={saveUi === "saving" || hydratingDraft || mediaStudioBusy.active}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={`${styles.primaryButton} ${cw.footerPrimaryCta}`}
                    disabled={loadingCreate || showCompletionCard || hydratingDraft || saveUi === "saving"}
                    aria-busy={loadingCreate && !showCompletionCard}
                  >
                    {showCompletionCard ? "Submitted ✓" : loadingCreate ? "Submitting…" : "Submit for review"}
                  </button>
                )}
              </div>
            </div>
            </div>
          </form>

          {mediaStudioBusy.active ? (
            <div
              className={cw.mediaUploadOverlayRoot}
              role="alertdialog"
              aria-modal="true"
              aria-live="polite"
              aria-busy="true"
              aria-labelledby="create-media-upload-title"
            >
              <div className={cw.mediaUploadOverlayBackdrop} aria-hidden />
              <div className={cw.mediaUploadOverlayPanel}>
                <p id="create-media-upload-title" className={cw.mediaUploadTitle}>
                  Uploading photos…
                </p>
                <p className={cw.mediaUploadSub}>
                  {mediaStudioBusy.phase === "syncing"
                    ? "Please wait while your media studio syncs."
                    : "Your inventory gallery is being prepared with care."}
                </p>
                <p className={cw.mediaUploadTertiary}>
                  {mediaStudioBusy.phase === "optimizing"
                    ? "Optimizing images"
                    : mediaStudioBusy.phase === "uploading" && mediaStudioBusy.total > 0
                      ? mediaStudioBusy.done === 0
                        ? "Preparing uploads…"
                        : `Uploading ${mediaStudioBusy.done} of ${mediaStudioBusy.total}`
                      : mediaStudioBusy.phase === "syncing"
                        ? "Preparing gallery"
                        : ""}
                </p>
                <div className={cw.mediaUploadShimmerBar} aria-hidden>
                  <div className={cw.mediaUploadShimmerFill} />
                </div>
              </div>
            </div>
          ) : null}

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
        </div>
      </main>
    </div>
  );
}
