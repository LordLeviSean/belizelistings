import { useRouter } from "next/router";
import Link from "next/link";

export default function BannerPage() {
  const { slug } = useRouter().query;

  // Convert slug to nice title: "featured-agent" → "Featured Agent"
  const title = slug
    ? slug
        .split("-")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "";

  return (
    <div style={{
      padding: "50px",
      fontFamily: "Open Sans, sans-serif",
      maxWidth: "800px",
      margin: "0 auto",
      textAlign: "center"
    }}>
      <h1 style={{ fontFamily: "Montserrat", fontSize: "36px", marginBottom: "20px" }}>
        {title}
      </h1>

      <p style={{ fontSize: "18px", marginBottom: "40px", color: "#555" }}>
        Details about <strong>{title}</strong> go here. You can list properties, agents, or business info.
      </p>

      <Link href="/" style={{
        display: "inline-block",
        padding: "10px 20px",
        backgroundColor: "#2e5d3c",
        color: "#fff",
        borderRadius: "12px",
        textDecoration: "none",
        fontFamily: "Montserrat",
        fontWeight: "bold",
        transition: "background 0.3s"
      }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#3a6f50"}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = "#2e5d3c"}
      >
        ← Back to Home
      </Link>
    </div>
  );
}
