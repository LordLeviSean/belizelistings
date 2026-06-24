import { useEffect } from "react";
import { useRouter } from "next/router";

/** Legacy route — redirects to `/agents/{username}`. */
export default function LegacyAgentProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.username;
    const username = String(Array.isArray(raw) ? raw[0] : raw || "").trim();
    if (!username) return;
    router.replace(`/agents/${encodeURIComponent(username)}`);
  }, [router.isReady, router.query.username, router]);

  return null;
}
