import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { createDebugger } from "@/lib/debug";
import SiteNav from "../../components/SiteNav";
import BackButton from "../../components/BackButton";
import Breadcrumbs from "../../components/Breadcrumbs";
import AgentAccessGate from "../../components/AgentAccessGate";
import useAuth from "../../hooks/useAuth";
import useRoleAccess from "../../hooks/useRoleAccess";
import { supabase } from "../../lib/supabaseClient";
import { traceAction, traceLog, traceWarn } from "../../lib/trace";
import { useToast } from "../../components/ui/ToastProvider";
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
const DISTRICTS = ["Belize", "Cayo", "Stann Creek", "Toledo", "Orange Walk", "Corozal"];

function qv(value) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function districtForSelect(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (DISTRICTS.includes(raw)) return raw;
  const normalized = raw
    .replace(/-/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return DISTRICTS.includes(normalized) ? normalized : "";
}

export default function DashboardCreatePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { roleLoading, canCreateListings } = useRoleAccess(user?.id);
  const [form, setForm] = useState(INITIAL_FORM);
  const [files, setFiles] = useState([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [success, setSuccess] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [progressStep, setProgressStep] = useState("");
  const [progressValue, setProgressValue] = useState(0);
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
  const isDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "true";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loadingCreate) return;

    const timeout = setTimeout(() => {
      traceWarn("CREATE TIMEOUT RESET");
      setLoadingCreate(false);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [loadingCreate]);

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
      setProgressStep("Creating Listing...");
      setProgressValue(35);
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

      const title = form.title.trim();
      const district = form.district.trim().toLowerCase().replace(/\s+/g, "-");
      const property_type = form.property_type.trim().toLowerCase();
      const price = Number(form.price);
      const beds = Number(form.beds || 0);
      const baths = Number(form.baths || 0);
      const nextErrors = {};
      if (!title) nextErrors.title = "Title is required.";
      if (!property_type || !PROPERTY_TYPES.includes(property_type)) {
        nextErrors.property_type = "Select a valid property type.";
      }
      if (!district || !DISTRICTS.map((d) => d.toLowerCase().replace(/\s+/g, "-")).includes(district)) {
        nextErrors.district = "Select a valid district.";
      }
      if (Number.isNaN(price) || price <= 0) nextErrors.price = "Enter a valid price.";
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) {
        setFeedback("Please fix the highlighted fields.");
        return;
      }

      const listing_type = form.listing_type;
      const payload = {
        title,
        price,
        property_type,
        district,
        listing_type,
        beds,
        baths,
        garage: 0,
        currency: "BZD",
        // All new listings must enter moderation pipeline
        status: "pending",
        user_id: authUser.id,
        property_id: linkedPropertyId || null,
        unit_id: linkedUnitId || null,
      };
      traceLog("INSERT PAYLOAD:", payload);
      traceAction({ type: "create_listing", payload });
      debugRef.current.log("LISTING_PAYLOAD", payload);

      const { data: listingData, error } = await supabase.from("listings").insert(payload).select().single();
      debugRef.current.log("LISTING_RESULT", { data: listingData, error });
      setDebugState(debugRef.current.getState());
      traceAction({
        type: "create_listing_result",
        payload: { title: payload.title, user_id: payload.user_id },
        result: { listingId: listingData?.id ?? null, error: error?.message ?? null },
      });
      if (error || !listingData) throw error || new Error("Could not create listing.");

      traceLog("INSERT SUCCESS:", listingData.id);

      if (linkedUnitId) {
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
      setProgressStep("Uploading Images...");
      setProgressValue(70);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        debugRef.current.log("UPLOAD_FILE_INDEX", i);
        const filePath = `${authUser.id}/${Date.now()}-${i}-${file.name}`;
        debugRef.current.log("FILE_PATH", filePath);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(filePath, file);
        traceLog("UPLOAD RESULT:", uploadData);
        if (uploadError) throw uploadError;

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
      }

      traceLog("CREATE FLOW COMPLETE");
      setProgressStep("Finalizing...");
      setProgressValue(90);
      setProgressStep("Success");
      setProgressValue(100);
      createSucceeded = true;
      setSuccess(true);
      setLoadingCreate(false);
      showToast({ type: "success", message: "Listing submitted for approval" });
      setTimeout(() => {
        router.push("/admin?tab=pending");
      }, 1100);
    } catch (createError) {
      console.error("CREATE ERROR:", createError);
      setFeedback(createError?.message || "Failed to create listing");
      showToast({ type: "error", message: createError?.message || "Failed to create listing" });
    } finally {
      setLoadingCreate(false);
      if (!createSucceeded) {
        setProgressStep("");
        setProgressValue(0);
      }
    }
  };

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
        {success && (
          <div className={styles.successBanner}>
            <span className={styles.successIcon}>✓</span> Listing Submitted Successfully
          </div>
        )}
        <form className={styles.form} onSubmit={handleSubmit} autoComplete="off" data-lpignore="true">
          <input type="text" name="fake-field" autoComplete="off" style={{ display: "none" }} />
          {loadingCreate ? (
            <div className={styles.progressWrap}>
              <div className={styles.progressHeader}>
                <span>{progressStep || "Processing..."}</span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${progressValue}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
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
            <option value="">Select district</option>
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
          <button type="submit" className={styles.primaryButton} disabled={loadingCreate}>
            {loadingCreate ? progressStep || "Processing..." : success ? "Created ✓" : "Create Listing"}
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
