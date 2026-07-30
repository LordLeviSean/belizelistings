import DashboardMetricsStrip from "@/components/dashboard/DashboardMetricsStrip";
import DashboardOperationalStatCard from "@/components/dashboard/DashboardOperationalStatCard";

export default function AdminOperationalStats({ total, pending, approved, rejected, archived, users }) {
  return (
    <DashboardMetricsStrip>
      <DashboardOperationalStatCard
        label="Total Listings"
        value={total}
        variant="Total"
        sublabel="Pending + Approved + Rejected + Archived"
      />
      <DashboardOperationalStatCard label="Pending Review" value={pending} variant="Pending" />
      <DashboardOperationalStatCard label="Approved" value={approved} variant="Approved" />
      <DashboardOperationalStatCard label="Rejected" value={rejected} variant="Rejected" />
      <DashboardOperationalStatCard label="Archived" value={archived} variant="Archived" />
      <DashboardOperationalStatCard label="Users" value={users} variant="Users" />
    </DashboardMetricsStrip>
  );
}
