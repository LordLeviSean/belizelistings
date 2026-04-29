export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        © 2026 BelizeListings.bz — Blake & Co.
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    marginTop: "60px",
    padding: "40px 20px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
  },
  inner: {
    textAlign: "center",
    fontSize: "13px",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.3px",
  },
};
