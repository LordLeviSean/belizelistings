import { useEffect } from "react";
import { useRouter } from "next/router";
import useUserRole from "@/hooks/useUserRole";

export default function DashboardEntry() {
  const router = useRouter();
  const { user, role, loading } = useUserRole();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role === "admin") {
      router.replace("/admin");
    } else if (role === "agent") {
      router.replace("/dashboard/agent");
    } else {
      router.replace("/dashboard/user");
    }
  }, [loading, user, role, router]);

  return null;
}
