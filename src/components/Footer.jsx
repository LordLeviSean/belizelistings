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
    marginTop: "8px",
    padding: "16px 20px",
    borderTop: "1px solid rgba(151,190,179,0.12)",
    background: "linear-gradient(to top, rgba(239,249,245,0.7), transparent)",
  },
  inner: {
    textAlign: "center",
    fontSize: "14px",
    fontWeight: 500,
    color: "rgba(57,91,82,0.7)",
    letterSpacing: "0.28px",
  },
};
