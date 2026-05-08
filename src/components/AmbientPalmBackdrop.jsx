import styles from "./AmbientPalmBackdrop.module.css";

/**
 * Abstract palm-adjacent silhouettes — blurred, multiplied, ultra-low contrast.
 */
export default function AmbientPalmBackdrop() {
  return (
    <div className={styles.root} aria-hidden>
      <svg
        className={styles.palmWest}
        viewBox="0 0 440 660"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="188" cy="520" rx="138" ry="392" transform="rotate(-22 188 520)" fill="currentColor" />
        <ellipse cx="242" cy="460" rx="92" ry="352" transform="rotate(12 242 460)" fill="currentColor" opacity=".72" />
        <ellipse cx="118" cy="440" rx="64" ry="280" transform="rotate(-8 118 440)" fill="currentColor" opacity=".5" />
      </svg>
      <svg
        className={styles.palmEast}
        viewBox="0 0 440 660"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse cx="252" cy="520" rx="138" ry="392" transform="rotate(22 252 520)" fill="currentColor" />
        <ellipse cx="198" cy="460" rx="92" ry="352" transform="rotate(-12 198 460)" fill="currentColor" opacity=".72" />
        <ellipse cx="322" cy="440" rx="64" ry="280" transform="rotate(8 322 440)" fill="currentColor" opacity=".5" />
      </svg>
    </div>
  );
}
