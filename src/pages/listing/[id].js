import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { fetchListingByIdWithImages } from "../../lib/listingQueries";
import { getListingValidImages } from "../../utils/listingImage";
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
  const [index, setIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (!id) return;
    queueMicrotask(() => setIndex(0));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data } = await fetchListingByIdWithImages(id);
      if (!cancelled) setListing(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!router.isReady) {
    return (
      <div className={styles.notFoundPage}>
        <p className={styles.loadingText}>Loading…</p>
      </div>
    );
  }

  if (!listing) {
    return null;
  }

  const validImages = getListingValidImages(listing);
  const hasImages = listing.images?.length > 0;
  const isLand = listing.beds === 0 && listing.baths === 0 && listing.garage === 0;

  const prevImage = () => {
    if (!hasImages) return;
    setIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const nextImage = () => {
    if (!hasImages) return;
    setIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e) => {
    if (!hasImages) return;
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e) => {
    if (!hasImages || !touchStartX.current) return;

    const delta = e.changedTouches[0].clientX - touchStartX.current;

    if (delta > 50) prevImage();
    else if (delta < -50) nextImage();

    touchStartX.current = null;
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.state?.idx > 0) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className={styles.page}>
      <div
        className={styles.hero}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {hasImages ? (
          <>
            <Image
              src={validImages[index]}
              alt={listing.title}
              fill
              priority
              className={styles.heroImage}
              onClick={() => setIsFullscreen(true)}
            />

            {validImages.length > 1 && (
              <>
                <button type="button" className={styles.arrowLeft} onClick={prevImage}>
                  ‹
                </button>
                <button type="button" className={styles.arrowRight} onClick={nextImage}>
                  ›
                </button>

                <div className={styles.dots}>
                  {validImages.map((_, i) => (
                    <span
                      key={i}
                      className={`${styles.dot} ${i === index ? styles.activeDot : ""}`}
                      onClick={() => setIndex(i)}
                    />
                  ))}
                </div>

                <div className={styles.thumbnails}>
                  {validImages.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`${styles.thumbBtn} ${i === index ? styles.activeThumb : ""}`}
                      onClick={() => setIndex(i)}
                      aria-label={`Show image ${i + 1}`}
                    >
                      <Image
                        src={img}
                        alt=""
                        width={72}
                        height={54}
                        className={styles.thumbImg}
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className={styles.noImage}>NO PHOTO</div>
        )}
      </div>

      {isFullscreen && hasImages && (
        <div className={styles.fullscreen} onClick={() => setIsFullscreen(false)}>
          <Image
            src={validImages[index]}
            alt=""
            fill
            className={styles.fullscreenImage}
          />

          <button
            type="button"
            className={styles.arrowLeft}
            onClick={(e) => {
              e.stopPropagation();
              prevImage();
            }}
          >
            ‹
          </button>

          <button
            type="button"
            className={styles.arrowRight}
            onClick={(e) => {
              e.stopPropagation();
              nextImage();
            }}
          >
            ›
          </button>
        </div>
      )}

      <div className={styles.container}>
        <div className={styles.listingHeader}>
          <button type="button" onClick={handleBack} className={backStyles.backSubtle}>
            ← Back
          </button>
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
