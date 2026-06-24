import { useEffect } from "react";
import { useRouter } from "next/router";
import { LOGIN_PATH } from "@/constants/authRoutes";

/**
 * Legacy path: this app’s canonical sign-in route is `/login`.
 */
export default function SigninRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query || {};
    const qs = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
      if (v === undefined) return;
      if (Array.isArray(v)) v.forEach((item) => qs.append(k, String(item)));
      else qs.append(k, String(v));
    });
    const tail = qs.toString();
    void router.replace(tail ? `${LOGIN_PATH}?${tail}` : LOGIN_PATH);
  }, [router.isReady, router.query, router]);

  return null;
}
