import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.brandMark}>BelizeListings.bz</span>
        <span className={styles.dot}> · </span>
        <span>© 2026</span>
        <span className={styles.brand}>A Black Reef Labs platform</span>
      </div>
    </footer>
  );
}
