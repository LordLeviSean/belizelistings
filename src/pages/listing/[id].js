/*
NOTE:
This file mixes Tailwind + CSS Modules intentionally.
Avoid introducing new layout logic in Tailwind.
Use CSS modules for structural layout.
*/

import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import { createDebugger } from "@/lib/debug";
import ListingImage from "@/components/ui/ListingImage";
import { supabase } from "../../lib/supabaseClient";
import styles from "../../styles/ListingDetail.module.css";
import backStyles from "../../styles/BackNav.module.css";

const formatDistrict = (district) =>
  district
    ?.split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export default function ListingPage() {
  const router = useRouter();
  const { id } = router.query;

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const debugRef = useRef(createDebugger("PUBLIC_PAGE"));
  const [debugState, setDebugState] = useState({});
  const isDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "true";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("listings")
          .select(`
          *,
          listing_images (
            image_url,
            position
          )
        `)
          .eq("id", id)
          .single();

        debugRef.current.log("RAW_DB_RESPONSE", data);
        debugRef.current.log("LISTING_FETCH", { data, error });

        const images = (data?.listing_images || [])
          .filter((img) => img?.image_url?.startsWith("http"))
          .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
        const mainImage = images.length > 0 ? images[0].image_url : null;

        debugRef.current.log("FINAL_LISTING", data);
        debugRef.current.log("IMAGES_ARRAY", data?.listing_images);
        debugRef.current.log("MAIN_IMAGE", mainImage);
        debugRef.current.log("IMAGE_COUNT", images.length);
        debugRef.current.log("FIRST_IMAGE", images[0]?.image_url);

        if (!cancelled) {
          setListing(data);
          setDebugState(debugRef.current.getState());
        }

        if (images.length === 0) {
          setTimeout(async () => {
            const retry = await supabase
              .from("listings")
              .select(`*, listing_images (image_url, position)`)
              .eq("id", id)
              .single();

            debugRef.current.log("RETRY_FETCH", retry.data);

            if (retry.data?.listing_images?.length > 0 && !cancelled) {
              setListing(retry.data);
              setDebugState(debugRef.current.getState());
            }
          }, 800);
        }
      } catch (fetchError) {
        debugRef.current.log("LISTING_FETCH_FAILED", fetchError);
        if (!cancelled) {
          setListing(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const images = (listing?.listing_images || [])
    .filter((img) => img && img.image_url && img.image_url.startsWith("http"))
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  const mainImage = images[0]?.image_url;
  useEffect(() => {
    if (images.length === 0) return;
    if (index >= images.length) setIndex(0);
  }, [images, index]);
  useEffect(() => {
    const handleKey = (e) => {
      if (!lightboxOpen) return;
      if (images.length === 0) return;

      if (e.key === "ArrowRight") {
        setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }

      if (e.key === "ArrowLeft") {
        setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      }

      if (e.key === "Escape") {
        setLightboxOpen(false);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, images.length]);

  if (!router.isReady) {
    return (
      <div className={styles.notFoundPage}>
        <p className={styles.loadingText}>Loading…</p>
      </div>
    );
  }

  if (loading) return <div>Loading listing...</div>;

  if (!listing) return <div>Listing not found</div>;
  const isLand = listing.beds === 0 && listing.baths === 0 && listing.garage === 0;

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.state?.idx > 0) {
      router.back();
    } else {
      router.push("/");
    }
  };

  console.log("IMAGES_FINAL:", images);
  console.log("RAW_IMAGES_FROM_DB:", listing?.listing_images);
  console.log("MAIN_IMAGE:", mainImage);
  console.log("INDEX:", index);
  console.log("CURRENT_IMAGE:", images[index]?.image_url);
  console.log("IMAGE_COUNT:", images.length);

  if (!images.length) {
    return <div className="h-[420px] flex items-center justify-center">NO IMAGES</div>;
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.heroColumn} safeFlexCol`} aria-label="Listing photos">
        <div
          className={styles.mainImageFrame}
          onClick={() => {
            setLightboxOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setLightboxOpen(true);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <ListingImage
            src={images[index]?.image_url}
            alt="Listing"
            mode="contain"
          />
        </div>
        {images.length > 1 && (
          <div className={styles.thumbRow}>
            {images.map((img, i) => (
              <button
                key={img.image_url || i}
                type="button"
                className={`${styles.thumbCell} ${i === index ? styles.thumbCellActive : ""}`}
                onClick={() => {
                  setIndex(i);
                  setLightboxOpen(true);
                }}
                aria-label={`View photo ${i + 1}`}
              >
                <ListingImage src={img.image_url} alt="" mode="cover" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={`${styles.detailColumn} safeFlexCol`}>
        <div className={styles.detailTop}>
          <button type="button" onClick={handleBack} className={backStyles.backSubtle}>
            ← Back
          </button>
        </div>
        <div className={`${styles.detailBody} safeFlexCol`}>
          <div className={`${styles.container} safeFlexCol`}>
          <div className={`${styles.listingHeader} safeFlexCol`}>
            <h1 className={styles.title}>{listing.title}</h1>
            <p className={styles.price}>
              {listing.price.toLocaleString()} {listing.currency}
            </p>
            <span className={styles.location}>
              {formatDistrict(listing.district)}, Belize
            </span>
          </div>

          <div className={styles.infoGrid}>
            {isLand ? (
              <Info label="Type" value="Land Property" />
            ) : (
              <>
                <Info label="Beds" value={listing.beds} />
                <Info label="Baths" value={listing.baths} />
                <Info label="Garage" value={listing.garage} />
              </>
            )}
            <Info label="District" value={formatDistrict(listing.district)} />
          </div>

          <div className={styles.description}>
            <p>
              A well-positioned property in{" "}
              <strong>{formatDistrict(listing.district)}</strong>, offering strong potential for both
              living and investment.
            </p>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn}>
              Contact Agent
            </button>
            <button type="button" className={styles.secondaryBtn}>
              Schedule Viewing
            </button>
          </div>
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
        </div>
      </section>

      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 text-white text-3xl z-50"
          >
            ✕
          </button>

          <div
            className="flex w-full items-center justify-center px-4"
            style={{ height: "90dvh", maxHeight: "90dvh", minHeight: 0 }}
          >
            <ListingImage
              src={images[index]?.image_url}
              alt="Listing full size"
              mode="contain"
              style={{ maxHeight: "90dvh", width: "auto", maxWidth: "100%" }}
            />
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={() =>
                  setIndex((prev) => (prev - 1 + images.length) % images.length)
                }
                className="absolute left-6 top-1/2 -translate-y-1/2 text-white text-4xl"
              >
                ‹
              </button>

              <button
                onClick={() =>
                  setIndex((prev) => (prev + 1) % images.length)
                }
                className="absolute right-6 top-1/2 -translate-y-1/2 text-white text-4xl"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className={styles.infoBox}>
      <span className={styles.infoLabel}>{label}</span>
      <strong className={styles.infoValue}>{value}</strong>
    </div>
  );
}
