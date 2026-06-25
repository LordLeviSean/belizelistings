import {
  parseInlineDescriptionSegments,
  parseListingDescriptionBlocks,
} from "@/lib/listingDescriptionFormat";
import styles from "./ListingDescriptionContent.module.css";

function InlineSegments({ text }) {
  const segments = parseInlineDescriptionSegments(text);
  return segments.map((segment, i) => {
    if (segment.type === "phone") {
      return (
        <a key={`${segment.href}-${i}`} href={segment.href} className={styles.inlineLink}>
          {segment.value}
        </a>
      );
    }
    if (segment.type === "url") {
      return (
        <a
          key={`${segment.href}-${i}`}
          href={segment.href}
          className={styles.inlineLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          {segment.value}
        </a>
      );
    }
    return <span key={`text-${i}`}>{segment.value}</span>;
  });
}

export default function ListingDescriptionContent({ description }) {
  const text = String(description || "").trim();
  if (!text) return null;

  const blocks = parseListingDescriptionBlocks(text);

  return (
    <div className={styles.content}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <h3 key={`h-${i}`} className={styles.sectionHeading}>
              {block.label}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={`ul-${i}`} className={styles.list}>
              {block.items.map((item, j) => (
                <li key={`li-${i}-${j}`} className={styles.listItem}>
                  <InlineSegments text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={`p-${i}`} className={styles.paragraph}>
            <InlineSegments text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
