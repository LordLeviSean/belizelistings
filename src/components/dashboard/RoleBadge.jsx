import { Building2, Network, Scale, Shield, User } from "lucide-react";
import { DASHBOARD_ROLE_META } from "@/constants/dashboardRoles";
import styles from "./RoleBadge.module.css";

const TONE_CLASS = {
  agent: styles.toneAgent,
  broker: styles.toneBroker,
  operator: styles.toneOperator,
  admin: styles.toneAdmin,
  user: styles.toneUser,
};

const ROLE_ICON = {
  agent: Building2,
  broker: Network,
  operator: Scale,
  admin: Shield,
  user: User,
};

export default function RoleBadge({ roleKey }) {
  const meta = DASHBOARD_ROLE_META[roleKey] || DASHBOARD_ROLE_META.agent;
  const toneClass = TONE_CLASS[meta.tone] || styles.toneAgent;
  const Icon = ROLE_ICON[meta.tone] || Building2;
  return (
    <span className={`${styles.badge} ${toneClass}`} data-dashboard-role={roleKey}>
      <Icon className={styles.roleIcon} strokeWidth={1.85} aria-hidden />
      {meta.badgeLabel}
    </span>
  );
}
