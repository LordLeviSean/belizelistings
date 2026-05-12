/*
NOTE:
This file mixes Tailwind + CSS Modules intentionally.
Avoid introducing new layout logic in Tailwind.
Use CSS modules for structural layout.
*/

import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import { createDebugger } from "@/lib/debug";
import { Heart } from "lucide-react";
import ListingMediaImage from "@/components/listing/ListingMediaImage";
import ListingMediaIntrinsic from "@/components/listing/ListingMediaIntrinsic";
import BackButton from "@/components/BackButton";
import SiteNav from "@/components/SiteNav";
import { fetchListingByIdWithImages } from "../../lib/listingQueries";
import useAuth from "../../hooks/useAuth";
import useRoleAccess from "../../hooks/useRoleAccess";
import useFavorites from "../../hooks/useFavorites";
import { getRegionCaption, getRegionLabel } from "../../constants/geographyLayer";
import { getListingRegionSlug } from "../../utils/canonicalListing";
import styles from "../../styles/ListingDetail.module.css";
import favoriteStyles from "../../styles/FavoriteButton.module.css";
import { useFavoriteSignupPrompt } from "../../components/FavoriteSignupPromptProvider";
import ListingTrustStrip from "@/components/listing/ListingTrustStrip";
import ListingContactActions from "@/components/listing/ListingContactActions";
import { getListingAtmosphereKey } from "@/utils/listingAtmosphere";
import { derivePropertyHighlights } from "@/utils/propertyHighlights";
import { isLandInventoryListing } from "../../utils/listingPresentation";

const formatDistrict = (district) => getRegionLabel(district);

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
  const openFavoriteSignupPrompt = useFavoriteSignupPrompt();
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
    if (!router.isReady || !id || images.length === 0) return;
    try {
      const raw = sessionStorage.getItem(`bl_listing_gallery_${id}`);
      if (raw != null) {
        const n = parseInt(raw, 10);
        if (!Number.isNaN(n)) {
          setIndex(Math.min(Math.max(0, n), images.length - 1));
        }
      }
    } catch {
      /* ignore */
    }
  }, [id, router.isReady, images.length]);

  useEffect(() => {
    if (!id) return;
    try {
      sessionStorage.setItem(`bl_listing_gallery_${id}`, String(index));
    } catch {
      /* ignore */
    }
  }, [id, index]);

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
      if (images.length === 0) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = String(e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      }

      if (e.key === "Escape") {
        if (!lightboxOpen) return;
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
    if (Math.abs(dx) < 34) return;
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
      <div className={styles.pageShell}>
        <SiteNav active="browse" />
        <div className={styles.notFoundPage}>
          <p className={styles.loadingText}>Loading…</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.pageShell}>
        <SiteNav active="browse" />
        <div className={styles.loadingState}>Loading listing...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className={styles.pageShell}>
        <SiteNav active="browse" />
        <div className={styles.loadingState}>Listing not found</div>
      </div>
    );
  }
  const isLand = isLandInventoryListing(listing);
  const regionSlug = getListingRegionSlug(listing);
  const regionLabel = formatDistrict(regionSlug);
  const regionCaption = getRegionCaption(regionSlug);

  const atmosphere = getListingAtmosphereKey(listing);
  const highlights = derivePropertyHighlights(listing);
  const descriptionText = String(listing?.description || "").trim();

  const hasImages = images.length > 0;

  return (
    <div className={styles.pageShell}>
      <SiteNav active="browse" />
      <div className={styles.page} data-atmosphere={atmosphere}>
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
          {hasImages ? <span className={styles.immersiveHint}>Immersive gallery · tap to expand</span> : null}
          <div className={styles.imageStage}>
            <div
              className={`${styles.heroImage} ${heroDip ? styles.heroImageFadeChanging : ""}`}
            >
              <ListingMediaImage
                src={images[index]?.image_url || "/placeholder.jpg"}
                alt="Listing"
                fill
                mode="contain"
                sizes="(max-width: 520px) 100vw, (max-width: 1100px) 92vw, min(960px, 52vw)"
                quality={90}
                priority={index === 0}
                hoverZoom={false}
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
                <ListingMediaImage
                  src={img.image_url}
                  alt=""
                  fill
                  sizes="(max-width: 900px) 18vw, 120px"
                  quality={78}
                  hoverZoom={false}
                />
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
              <BackButton label="Back" className={styles.backButton} />
            </div>
            <div>
              <button
                type="button"
                aria-label={isFavorite(listing.id) ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={isFavorite(listing.id)}
                onClick={() => {
                  if (!isAuthenticated) {
                    openFavoriteSignupPrompt();
                    return;
                  }
                  void toggleFavorite(listing.id);
                }}
                disabled={isBusy(listing.id)}
                className={`${favoriteStyles.favoriteButton} ${
                  isFavorite(listing.id) ? favoriteStyles.favoriteButtonActive : ""
                }`}
              >
                <Heart fill={isFavorite(listing.id) ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>
        <div className={`${styles.detailBody} safeFlexCol`}>
          <div className={`${styles.container} safeFlexCol`}>
          <div className={`${styles.listingHeader} safeFlexCol`}>
            <h1 className={styles.title}>{listing.title}</h1>
            <p className={styles.price}>
              {listing.price.toLocaleString()} {listing.currency || "BZD"}
            </p>
            <span className={styles.location}>
              {regionLabel}
            </span>
            {regionCaption ? <span className={styles.locationCaption}>{regionCaption}</span> : null}
          </div>

          <ListingTrustStrip listing={listing} />

          {highlights.length > 0 ? (
            <div className={styles.highlightStrip} aria-label="Highlights">
              {highlights.map((h) => (
                <span key={`${h.label}-${h.source}`} className={styles.highlightChip}>
                  {h.label}
                </span>
              ))}
            </div>
          ) : null}

          <div className={styles.infoGrid}>
            {isLand ? (
              <Info label="Type" value="Land" />
            ) : (
              <>
                <Info label="Beds" value={listing.beds} />
                <Info label="Baths" value={listing.baths} />
                <Info label="Garage" value={listing.garage} />
              </>
            )}
            <Info label="Region" value={regionLabel} />
          </div>

          {descriptionText ? (
            <section className={styles.description} aria-labelledby="story-heading">
              <h2 id="story-heading" className={styles.storyLead}>
                About this property
              </h2>
              {descriptionText.split(/\n+/).map((para, pi) => (
                <p key={pi} className={styles.storyBody}>
                  {para}
                </p>
              ))}
            </section>
          ) : null}

          <div className={styles.locContext}>
            <p className={styles.locContextBlurb}>
              {regionCaption ? `${regionCaption} · ` : ""}
              <Link href={`/listings/district/${encodeURIComponent(regionSlug)}`} className={styles.locLink}>
                Explore {regionLabel}
              </Link>
            </p>
          </div>

          <ListingContactActions listing={listing} user={user} />
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
              <ListingMediaIntrinsic src={images[index]?.image_url} alt="Listing full size" />
            </div>
          </div>

          {images.length > 1 ? (
            <div
              className={styles.lightboxThumbRail}
              role="tablist"
              aria-label="Gallery thumbnails"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, i) => (
                <button
                  key={img.image_url || i}
                  type="button"
                  className={`${styles.lightboxThumbBtn} ${i === index ? styles.lightboxThumbBtnActive : ""}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Photo ${i + 1}`}
                >
                  <ListingMediaImage
                    src={img.image_url}
                    alt=""
                    fill
                    sizes="(max-width: 900px) 14vw, 96px"
                    quality={78}
                    hoverZoom={false}
                  />
                </button>
              ))}
            </div>
          ) : null}
          </div>
        ) : null}
      </div>
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
