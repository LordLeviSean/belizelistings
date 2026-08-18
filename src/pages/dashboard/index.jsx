import { useEffect } from "react";
import { useRouter } from "next/router";
import DashboardBootstrapShell from "@/components/dashboard/DashboardBootstrapShell";
import {
  buildProtectedLoginHref,
  captureProtectedEntryFromWindow,
  readPendingProtectedEntry,
  resolveProtectedEntryHref,
  savePendingProtectedEntry,
} from "@/lib/auth/protectedEntry";
import useUserRole from "@/hooks/useUserRole";

export default function DashboardEntry() {
  const router = useRouter();
  const { user, role, loading } = useUserRole();

  useEffect(() => {
    const fromWindow = captureProtectedEntryFromWindow();
    if (fromWindow) {
      savePendingProtectedEntry(fromWindow);
    }
  }, []);

  useEffect(() => {
    if (loading || !router.isReady) return;

    const destination = resolveProtectedEntryHref({
      router,
      pendingFromStorage: readPendingProtectedEntry(),
    });

    if (!user) {
      if (destination) savePendingProtectedEntry(destination);
      router.replace(buildProtectedLoginHref(destination || router.asPath || "/dashboard"));
      return;
    }

    if (destination && destination !== router.asPath) {
      router.replace(destination);
      return;
    }

    if (role === "admin") {
      router.replace("/admin");
    } else if (role === "agent") {
      router.replace("/dashboard/agent");
    } else if (role === "broker" || role === "brokerage" || role === "property_manager") {
      router.replace("/dashboard/broker");
    } else {
      router.replace("/dashboard/user");
    }
  }, [loading, user, role, router, router.isReady, router.asPath]);

  return <DashboardBootstrapShell label="Loading dashboard" />;
}
