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
import { fetchListingByIdWithImages } from "../../lib/listingQueries";
import useAuth from "../../hooks/useAuth";
import useRoleAccess from "../../hooks/useRoleAccess";
import useFavorites from "../../hooks/useFavorites";
import styles from "../../styles/ListingDetail.module.css";
import backStyles from "../../styles/BackNav.module.css";
import favoriteStyles from "../../styles/FavoriteButton.module.css";

const formatDistrict = (district) =>
  district
    ?.split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export default function ListingPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { isAdmin, roleLoading } = useRoleAccess(user?.id);
  const requestedAdminBypass = router.query.admin === "true";
  const isAdminView = requestedAdminBypass && isAdmin;

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImageOpacity, setLightboxImageOpacity] = useState(1);
  const [heroDip, setHeroDip] = useState(false);
  const idRefForHeroDip = useRef();
  const touchStartXRef = useRef(null);
  const skipHeroClickRef = useRef(false);
  const debugRef = useRef(createDebugger("PUBLIC_PAGE"));
  const [debugState, setDebugState] = useState({});
  const { isFavorite, isBusy, toggleFavorite, isAuthenticated } = useFavorites();
  const isDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "true";

  useEffect(() => {
    if (!id) return;
    if (requestedAdminBypass && roleLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await fetchListingByIdWithImages(id, isAdminView);

        debugRef.current.log("RAW_DB_RESPONSE", data);
        debugRef.current.log("LISTING_FETCH", { data, error });

        if (error || !data) {
          if (!cancelled) {
            setListing(null);
            setDebugState(debugRef.current.getState());
          }
        } else {
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
            const retry = await fetchListingByIdWithImages(id, isAdminView);

            debugRef.current.log("RETRY_FETCH", retry.data);

            if (retry.data?.listing_images?.length > 0 && !cancelled) {
              setListing(retry.data);
              setDebugState(debugRef.current.getState());
            }
          }, 800);
        }
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
  }, [id, isAdminView, requestedAdminBypass, roleLoading]);

  const images = (listing?.listing_images || [])
    .filter((img) => img && img.image_url && img.image_url.startsWith("http"))
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  const mainImage = images[0]?.image_url;

  useEffect(() => {
    setIndex(0);
  }, [id]);

  useEffect(() => {
    if (images.length === 0) return;
    setIndex((i) => Math.min(Math.max(0, i), images.length - 1));
  }, [images.length, listing?.id]);

  useEffect(() => {
    if (idRefForHeroDip.current === undefined) {
      idRefForHeroDip.current = id;
      return;
    }
    if (idRefForHeroDip.current !== id) {
      idRefForHeroDip.current = id;
      return;
    }
    setHeroDip(true);
    const t = window.setTimeout(() => setHeroDip(false), 140);
    return () => window.clearTimeout(t);
  }, [index, id]);

  useEffect(() => {
    if (!lightboxOpen) return;
    setLightboxImageOpacity(0.88);
    const t = window.setTimeout(() => setLightboxImageOpacity(1), 60);
    return () => window.clearTimeout(t);
  }, [index, lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  useEffect(() => {
    const handleKey = (e) => {
      if (!lightboxOpen) return;
      if (images.length === 0) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setLightboxOpen(false);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, images.length]);

  const goPrev = () => {
    if (images.length === 0) return;
    setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goNext = () => {
    if (images.length === 0) return;
    setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const onHeroTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const onHeroTouchEnd = (e) => {
    if (touchStartXRef.current == null) return;
    if (e.changedTouches.length !== 1) {
      touchStartXRef.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (images.length < 2) return;
    if (Math.abs(dx) < 50) return;
    skipHeroClickRef.current = true;
    window.setTimeout(() => {
      skipHeroClickRef.current = false;
    }, 350);
    if (dx > 0) goPrev();
    else goNext();
  };

  const onMainImageFrameClick = () => {
    if (skipHeroClickRef.current) return;
    setLightboxOpen(true);
  };

  if (!router.isReady) {
    return (
      <div className={styles.notFoundPage}>
        <p className={styles.loadingText}>Loading…</p>
      </div>
    );
  }

  if (loading) return <div className={styles.loadingState}>Loading listing...</div>;

  if (!listing) return <div className={styles.loadingState}>Listing not found</div>;
  const isLand = listing.beds === 0 && listing.baths === 0 && listing.garage === 0;

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.state?.idx > 0) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const hasImages = images.length > 0;

  return (
    <div className={styles.page}>
      <section className={`${styles.heroColumn} safeFlexCol`} aria-label="Listing photos">
        <div
          className={styles.mainImageFrame}
          onClick={onMainImageFrameClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onMainImageFrameClick();
            }
          }}
          onTouchStart={onHeroTouchStart}
          onTouchEnd={onHeroTouchEnd}
          role="button"
          tabIndex={0}
        >
          {hasImages && images.length > 1 ? (
            <>
              <button
                type="button"
                className={`${styles.heroNavZone} ${styles.heroNavZonePrev}`}
                aria-label="Previous photo"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
              />
              <button
                type="button"
                className={`${styles.heroNavZone} ${styles.heroNavZoneNext}`}
                aria-label="Next photo"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
              />
            </>
          ) : null}
          {hasImages ? (
            <div className={styles.imageCounter} aria-hidden="true">
              {index + 1} / {images.length}
            </div>
          ) : null}
          <div className={styles.imageStage}>
            <div
              className={`${styles.heroImage} ${heroDip ? styles.heroImageFadeChanging : ""}`}
            >
              <ListingImage
                src={images[index]?.image_url || "/placeholder.jpg"}
                alt="Listing"
                mode="contain"
              />
            </div>
          </div>
        </div>
        {hasImages && images.length > 1 && (
          <div className={styles.thumbRow}>
            {images.map((img, i) => (
              <button
                key={img.image_url || i}
                type="button"
                className={`${styles.thumbCell} ${i === index ? styles.thumbCellActive : ""}`}
                onClick={() => setIndex(i)}
                onMouseEnter={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} in gallery`}
              >
                <ListingImage src={img.image_url} alt="" mode="cover" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={`${styles.detailColumn} safeFlexCol`}>
        <div className={styles.detailTop}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div>
              <button type="button" onClick={handleBack} className={backStyles.backSubtle}>
                ← Back
              </button>
            </div>
            <div>
              {isAuthenticated ? (
                <button
                  type="button"
                  aria-label={isFavorite(listing.id) ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={isFavorite(listing.id)}
                  onClick={() => toggleFavorite(listing.id)}
                  disabled={isBusy(listing.id)}
                  className={`${favoriteStyles.favoriteButton} ${
                    isFavorite(listing.id) ? favoriteStyles.favoriteButtonActive : ""
                  }`}
                >
                  {isFavorite(listing.id) ? "♥" : "♡"}
                </button>
              ) : null}
            </div>
          </div>
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

      {lightboxOpen ? (
        <div
          className={styles.lightboxBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Listing photos, fullscreen"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className={styles.lightboxCloseBtn}
            aria-label="Close fullscreen"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
          >
            ✕
          </button>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                className={`${styles.lightboxNavBtn} ${styles.lightboxNavBtnPrev}`}
                aria-label="Previous photo"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className={`${styles.lightboxNavBtn} ${styles.lightboxNavBtnNext}`}
                aria-label="Next photo"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
              >
                ›
              </button>
            </>
          ) : null}

          <div
            className={styles.lightboxImageShell}
            style={{ opacity: lightboxImageOpacity }}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className={styles.imageCounter} aria-hidden="true">
              {index + 1} / {images.length}
            </div>
            <div className={styles.lightboxImageInner}>
              <ListingImage
                src={images[index]?.image_url}
                alt="Listing full size"
                mode="contain"
                style={{
                  maxWidth: "95vw",
                  maxHeight: "90vh",
                  width: "auto",
                  height: "auto",
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
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
