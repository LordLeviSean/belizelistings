export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <span style={{ fontWeight: 600, letterSpacing: "0.06em", color: "rgba(52,86,94,0.82)" }}>
          BelizeListings.bz
        </span>
        <span style={{ opacity: 0.55 }}> · </span>
        <span>© 2026</span>
        <span style={styles.brand}>A Black Reef Labs platform</span>
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    marginTop: "4px",
    padding: "11px 12px 14px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    background:
      "linear-gradient(180deg, rgba(255,251,245,0.12) 0%, rgba(232,245,242,0.18) 42%, rgba(230,241,251,0.14) 100%)",
    backdropFilter: "blur(9px)",
    WebkitBackdropFilter: "blur(9px)",
    boxShadow: "0 -16px 32px rgba(110, 154, 148, 0.05)",
  },
  inner: {
    textAlign: "center",
    fontSize: "11.5px",
    fontWeight: 520,
    lineHeight: 1.45,
    color: "rgba(72, 102, 108, 0.76)",
    letterSpacing: "0.04em",
  },
  brand: {
    display: "block",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontSize: "10px",
    marginTop: "4px",
    color: "rgba(92, 122, 128, 0.65)",
    fontWeight: 600,
  },
};
