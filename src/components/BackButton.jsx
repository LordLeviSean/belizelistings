import { useRouter } from "next/router";

export default function BackButton({ fallback = "/", label = "Back", className = "backButton" }) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    const listingOrigin = typeof window !== "undefined" ? sessionStorage.getItem("listingOrigin") : null;

    if (listingOrigin && listingOrigin !== router.asPath) {
      router.push(listingOrigin);
      return;
    }

    const lastRoute = typeof window !== "undefined" ? sessionStorage.getItem("lastRoute") : null;

    if (lastRoute && lastRoute !== router.asPath) {
      router.push(lastRoute);
      return;
    }

    router.push(fallback);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={className}
    >
      ← {label}
    </button>
  );
}
