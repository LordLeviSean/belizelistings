import ListingMediaImage from "@/components/listing/ListingMediaImage";

/**
 * Bounded flex/gallery image — delegates to canonical {@link ListingMediaImage} (`fill`).
 * Parent must provide width + height (or flex stretch).
 */
export default function ListingImage({ src, alt = "", mode = "cover", className = "", style = {} }) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        ...style,
      }}
    >
      <ListingMediaImage
        src={src}
        alt={alt}
        fill
        mode={mode}
        sizes="(max-width: 1100px) 92vw, min(720px, 55vw)"
        quality={84}
        hoverZoom={false}
      />
    </div>
  );
}
