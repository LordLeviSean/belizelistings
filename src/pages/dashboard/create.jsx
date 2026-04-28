import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { createDebugger } from "@/lib/debug";
import SiteNav from "../../components/SiteNav";
import AgentAccessGate from "../../components/AgentAccessGate";
import useAuth from "../../hooks/useAuth";
import { supabase } from "../../lib/supabaseClient";
import styles from "../../styles/Dashboard.module.css";

const INITIAL_FORM = {
  title: "",
  price: "",
  district: "",
  listing_type: "sale",
  beds: "",
  baths: "",
};

export default function DashboardCreatePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAgent, setIsAgent] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const debugRef = useRef(createDebugger("CREATE_FLOW"));
  const [debugState, setDebugState] = useState({});
  const isDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "true";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const loadProfile = async () => {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!cancelled) {
        setIsAgent(data?.role === "agent");
        setProfileLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("AUTH USER ID:", user?.id);
    debugRef.current.log("USER", user);
    setDebugState(debugRef.current.getState());

    if (!user?.id) {
      console.error("NO AUTH USER ID");
      return;
    }
    if (submitting || isSubmitting) return;

    const title = form.title.trim();
    const district = form.district.trim().toLowerCase().replace(/\s+/g, "-");
    const price = Number(form.price);
    const beds = Number(form.beds || 0);
    const baths = Number(form.baths || 0);

    if (!title || !district || Number.isNaN(price)) {
      setFeedback("Please provide title, district, and valid price.");
      return;
    }

    setSubmitting(true);
    setIsSubmitting(true);
    setFeedback("");

    const listing_type = form.listing_type;
    const payload = {
      title,
      price,
      district,
      listing_type,
      beds,
      baths,
      garage: 0,
      currency: "BZD",
      status: "draft",
      user_id: user.id,
    };
    console.log("AUTH USER ID:", user.id);
    console.log("INSERT PAYLOAD:", payload);
    debugRef.current.log("LISTING_PAYLOAD", payload);

    const { data: listingData, error } = await supabase.from("listings").insert(payload).select().single();
    debugRef.current.log("LISTING_RESULT", { data: listingData, error });
    setDebugState(debugRef.current.getState());

    if (error || !listingData) {
      console.error("LISTING INSERT ERROR:", error);
      setFeedback(error?.message || "Could not create listing.");
      setSubmitting(false);
      setIsSubmitting(false);
      return;
    }
    console.log("INSERT SUCCESS:", listingData);

    const listingId = listingData.id;
    console.log("NEW LISTING ID:", listingId);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      debugRef.current.log("UPLOAD_FILE_INDEX", i);
      console.log("SELECTED FILE:", file);
      debugRef.current.log("FILE", file?.name);
      const filePath = `${user.id}/${Date.now()}-${i}-${file.name}`;
      debugRef.current.log("FILE_PATH", filePath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(filePath, file);
      console.log("UPLOAD RESULT:", uploadData);
      console.log("UPLOAD ERROR:", uploadError);
      debugRef.current.log("UPLOAD_RESULT", { uploadData, uploadError });

      if (uploadError) {
        console.error("UPLOAD ERROR:", uploadError);
        setSubmitting(false);
        setIsSubmitting(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("listing-images").getPublicUrl(filePath);
      const publicUrl = publicUrlData?.publicUrl;

      console.log("PUBLIC URL:", publicUrl);
      console.log("FINAL_IMAGE_URL:", publicUrl);
      debugRef.current.log("PUBLIC_URL", publicUrlData);

      if (publicUrl) {
        debugRef.current.log("IMAGE_INSERT_POSITION", i);
        const { data: imageInsert, error: imageError } = await supabase.from("listing_images").insert({
          listing_id: listingId,
          image_url: publicUrl,
          position: i,
        });
        debugRef.current.log("IMAGE_INSERT", { imageInsert, imageError });
        setDebugState(debugRef.current.getState());

        if (imageError) {
          console.error("IMAGE INSERT ERROR:", imageError);
        } else {
          console.log("IMAGE INSERT SUCCESS");
        }
      }
    }

    alert("Listing created successfully");
    setSubmitting(false);
    setIsSubmitting(false);
    await new Promise((res) => setTimeout(res, 500));
    router.push("/dashboard/listings");
  };

  if (loading || profileLoading) {
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

  if (!isAgent) {
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
        <h1 className={styles.title}>Create Listing</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <input className={styles.input} placeholder="Title" value={form.title} onChange={setField("title")} />
          <input className={styles.input} placeholder="Price" value={form.price} onChange={setField("price")} />
          <input className={styles.input} placeholder="District" value={form.district} onChange={setField("district")} />
          <select className={styles.select} value={form.listing_type} onChange={setField("listing_type")}>
            <option value="sale">sale</option>
            <option value="rent">rent</option>
          </select>
          <input className={styles.input} placeholder="Beds" value={form.beds} onChange={setField("beds")} />
          <input className={styles.input} placeholder="Baths" value={form.baths} onChange={setField("baths")} />
          <input
            className={styles.input}
            type="file"
            multiple
            accept="image/*"
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
          />
          <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Listing"}
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
