import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import useUserRole from "@/hooks/useUserRole";
import { BL_ENABLE_NOTIFICATIONS } from "@/lib/featureFlags";
import {
  disableDevicePushNotifications,
  enableDevicePushNotifications,
  loadPushDeviceStatus,
} from "@/lib/push/pushSubscriptionClient";
import { PUSH_CAPABILITY } from "@/lib/push/pushSubscriptionSupport";
import { supabase } from "@/lib/supabaseClient";
import styles from "./DeviceNotificationsPanel.module.css";

function formatPlatformLabel(label) {
  const normalized = String(label || "device").toLowerCase();
  if (normalized === "ios") return "iPhone / iPad";
  if (normalized === "android") return "Android";
  if (normalized === "desktop") return "Desktop";
  return label || "Device";
}

function statusCopy(capability, currentDeviceRegistered) {
  switch (capability) {
    case PUSH_CAPABILITY.UNSUPPORTED:
      return {
        badge: "Unavailable",
        badgeClass: styles.statusBadgeMuted,
        hint: "This browser does not support device notifications.",
      };
    case PUSH_CAPABILITY.IOS_NOT_INSTALLED:
      return {
        badge: "Install required",
        badgeClass: styles.statusBadgeWarn,
        hint: "On iPhone and iPad, add BelizeListings to your Home Screen first, then return here to enable notifications.",
      };
    case PUSH_CAPABILITY.PERMISSION_DENIED:
      return {
        badge: "Blocked",
        badgeClass: styles.statusBadgeWarn,
        hint: "Notifications are blocked for this site in your browser settings.",
      };
    case PUSH_CAPABILITY.IOS_INSTALLED:
    case PUSH_CAPABILITY.PERMISSION_GRANTED:
      return currentDeviceRegistered
        ? {
            badge: "Enabled",
            badgeClass: styles.statusBadge,
            hint: "This device can receive alerts when delivery is connected.",
          }
        : {
            badge: "Ready",
            badgeClass: styles.statusBadgeMuted,
            hint: "Turn on notifications for this device. In-app notifications remain your primary inbox.",
          };
    case PUSH_CAPABILITY.PERMISSION_DEFAULT:
    default:
      return {
        badge: "Off",
        badgeClass: styles.statusBadgeMuted,
        hint: "Enable notifications only when you want alerts on this device.",
      };
  }
}

export default function DeviceNotificationsPanel() {
  const { user, role } = useUserRole();
  const isVerifiedAdmin = String(role || "").toLowerCase() === "admin";
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null);
  const [status, setStatus] = useState(null);

  const refreshStatus = useCallback(async () => {
    if (!user?.id) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const next = await loadPushDeviceStatus(supabase, user.id);
    setStatus(next);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const handleToggle = useCallback(
    async (event) => {
      if (!user?.id || busy || !status) return;

      const turningOn = event.target.checked;

      if (!turningOn) {
        setBusy(true);
        await disableDevicePushNotifications({
          client: supabase,
          userId: user.id,
          subscriptionId: status.currentSubscriptionId,
        });
        await refreshStatus();
        setBusy(false);
        showToast({ type: "success", message: "Device notifications turned off." });
        return;
      }

      setBusy(true);
      const result = await enableDevicePushNotifications({
        client: supabase,
        userId: user.id,
        getAccessToken,
      });
      setBusy(false);

      if (!result.ok) {
        event.target.checked = false;
        if (result.error === PUSH_CAPABILITY.IOS_NOT_INSTALLED) {
          showToast({
            type: "info",
            message: "Install BelizeListings to your Home Screen first.",
          });
        } else if (result.error === "denied") {
          showToast({
            type: "error",
            message: "Notification permission was denied in your browser.",
          });
        } else if (result.error === "vapid_unavailable" || result.error === "vapid_not_configured") {
          showToast({
            type: "error",
            message: "Device notifications are not configured yet.",
          });
        } else {
          showToast({
            type: "error",
            message: "Could not enable notifications on this device.",
          });
        }
        await refreshStatus();
        return;
      }

      await refreshStatus();
      showToast({ type: "success", message: "Notifications enabled for this device." });
    },
    [busy, getAccessToken, refreshStatus, showToast, status, user?.id]
  );

  const handleSendTest = useCallback(async () => {
    if (!user?.id || testBusy || !status?.currentDeviceRegistered) return;

    setTestBusy(true);
    setTestFeedback(null);

    const token = await getAccessToken();
    if (!token) {
      setTestBusy(false);
      setTestFeedback({
        tone: "error",
        message: "Sign in again to send a test notification.",
      });
      return;
    }

    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.status === 429) {
        setTestFeedback({
          tone: "error",
          message: "Please wait a minute before sending another test notification.",
        });
        return;
      }

      if (!response.ok || !payload?.ok) {
        const message =
          payload?.error === "no_active_subscriptions"
            ? "No enabled devices were found for your account."
            : payload?.error === "vapid_not_configured"
              ? "Device notifications are not configured yet."
              : "Could not send a test notification right now.";
        setTestFeedback({ tone: "error", message });
        return;
      }

      setTestFeedback({
        tone: "success",
        message:
          payload.delivered > 0
            ? `Test accepted for ${payload.delivered} enabled device${payload.delivered === 1 ? "" : "s"}. Delivery may appear on every enabled device for this account.`
            : "Test accepted. Check each enabled device for delivery.",
      });
    } catch {
      setTestFeedback({
        tone: "error",
        message: "Could not send a test notification right now.",
      });
    } finally {
      setTestBusy(false);
    }
  }, [getAccessToken, status?.currentDeviceRegistered, testBusy, user?.id]);

  const ui = useMemo(() => {
    if (!status) return null;
    return statusCopy(status.capability.capability, status.currentDeviceRegistered);
  }, [status]);

  if (!BL_ENABLE_NOTIFICATIONS || !user?.id) {
    return null;
  }

  const capability = status?.capability;
  const switchChecked = Boolean(status?.currentDeviceRegistered);
  const switchDisabled =
    loading ||
    busy ||
    !capability ||
    capability.capability === PUSH_CAPABILITY.UNSUPPORTED ||
    capability.capability === PUSH_CAPABILITY.IOS_NOT_INSTALLED ||
    capability.capability === PUSH_CAPABILITY.PERMISSION_DENIED;

  return (
    <section className={styles.panel} aria-labelledby="device-notifications-title">
      <div className={styles.head}>
        <div>
          <h2 id="device-notifications-title" className={styles.title}>
            Device notifications
          </h2>
          <p className={styles.lede}>
            Optional alerts for this device. Your in-app notification center stays the source of truth.
          </p>
        </div>
        {ui ? (
          <span className={ui.badgeClass} aria-live="polite">
            {loading ? "Checking…" : ui.badge}
          </span>
        ) : null}
      </div>

      <div className={styles.controlRow}>
        <div className={styles.controlCopy}>
          <p className={styles.controlLabel}>Enable notifications</p>
          <p className={styles.controlHint}>
            {ui?.hint}
            {capability?.capability === PUSH_CAPABILITY.IOS_NOT_INSTALLED
              ? " Use Install App in the menu for Home Screen steps."
              : null}
          </p>
        </div>
        <label className={styles.switch}>
          <input
            type="checkbox"
            role="switch"
            aria-label="Enable device notifications"
            checked={switchChecked}
            disabled={switchDisabled}
            onChange={handleToggle}
          />
          <span className={styles.switchSlider} aria-hidden="true" />
        </label>
      </div>

      {switchChecked && isVerifiedAdmin ? (
        <div className={styles.testRow}>
          <div className={styles.testCopy}>
            <p className={styles.controlLabel}>Send test notification</p>
            <p className={styles.controlHint}>
              Admin diagnostic only. Sends a safe test alert to every enabled device for your signed-in admin account.
              Delivery timing depends on your platform and whether the app is open.
            </p>
            {testFeedback ? (
              <p
                className={
                  testFeedback.tone === "success" ? styles.testFeedbackSuccess : styles.testFeedbackError
                }
                role="status"
                aria-live="polite"
              >
                {testFeedback.message}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.testButton}
            onClick={handleSendTest}
            disabled={loading || busy || testBusy}
            aria-busy={testBusy}
          >
            {testBusy ? "Sending…" : "Send test notification"}
          </button>
        </div>
      ) : null}

      {status?.activeDevices?.length > 1 ? (
        <ul className={styles.deviceList} aria-label="Registered notification devices">
          {status.activeDevices.map((device) => (
            <li key={device.subscription_id} className={styles.deviceItem}>
              <span>
                {formatPlatformLabel(device.platform_label)}
                {device.subscription_id === status.currentSubscriptionId ? (
                  <span className={styles.currentTag}> · this device</span>
                ) : null}
              </span>
              <span className={styles.deviceMeta}>
                {device.updated_at
                  ? new Date(device.updated_at).toLocaleDateString()
                  : "Registered"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
