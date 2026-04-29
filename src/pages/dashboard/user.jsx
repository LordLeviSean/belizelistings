import { useEffect } from "react";
import { useRouter } from "next/router";
import SiteNav from "@/components/SiteNav";
import useUserRole from "@/hooks/useUserRole";

export default function UserDashboard() {
  const router = useRouter();
  const { user, role, loading } = useUserRole();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role !== "user") {
      router.replace("/dashboard");
    }
  }, [loading, user, role, router]);

  if (loading) return null;

  return (
    <div className="page">
      <SiteNav active="dashboard" />
      <div className="pageContent">
        <h1 className="pageTitle">Dashboard</h1>
        <p className="pageSubtitle">Browse and save listings.</p>
      </div>
    </div>
  );
}
