import { useEffect } from "react";
import { useRouter } from "next/router";

const BLOCKED_ROUTES = [
  "/login",
  "/signup",
  "/dashboard",
];

export default function useRouteMemory() {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url) => {
      const current = router.asPath;
      const currentPath = current.split("?")[0];

      if (
        url !== current &&
        !BLOCKED_ROUTES.includes(currentPath)
      ) {
        sessionStorage.setItem("lastRoute", current);
      }

      if (url.startsWith("/listing/")) {
        const origin = sessionStorage.getItem("lastRoute");
        if (origin) {
          sessionStorage.setItem("listingOrigin", origin);
        }
      }
    };

    router.events.on("routeChangeStart", handleRouteChange);

    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [router]);
}
