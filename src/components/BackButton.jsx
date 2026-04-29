import { useRouter } from "next/router";

export default function BackButton({ label = "Back" }) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.state?.idx > 0) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="backButton"
    >
      ← {label}
    </button>
  );
}
