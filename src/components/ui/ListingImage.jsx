import { useLayoutEffect, useRef } from "react";

/**
 * IMPORTANT:
 * This component does NOT define layout.
 * It MUST be used inside a container with:
 * - fixed width/height OR aspect-ratio
 * - overflow: hidden
 *
 * Misuse will cause layout issues.
 */
export default function ListingImage({ src, alt = "", mode = "cover", className = "", style = {} }) {
  const objectFit = mode === "contain" ? "contain" : "cover";
  const imgRef = useRef(null);

  useLayoutEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const el = imgRef.current;
    const parent = el?.parentElement;
    if (!parent) return;

    const bounded =
      parent.clientWidth >= 2 &&
      parent.clientHeight >= 2;

    if (!bounded) {
      console.warn("ListingImage used without a bounded container");
    }
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit,
        ...style,
      }}
    />
  );
}
