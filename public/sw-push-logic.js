/**
 * Shared Web Push display + click routing logic for BelizeListings service worker.
 * Loaded via importScripts from public/sw.js — plain JS, no bundler.
 */
/* eslint-disable no-restricted-globals */

(function initBelizeListingsPushLogic(global) {
  const DEFAULT_TITLE = "BelizeListings";
  const DEFAULT_BODY = "You have a new update.";
  const FALLBACK_HREF = "/dashboard/user?tab=profile";
  const NOTIFICATION_ICON = "/apple-touch-icon.png";

  function truncate(value, max) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
  }

  function isSafeRelativePath(href) {
    if (typeof href !== "string") return false;
    const value = href.trim();
    if (!value) return false;
    if (/^https?:\/\//i.test(value)) return false;
    if (value.startsWith("//")) return false;
    if (value.includes("\\")) return false;
    if (!value.startsWith("/")) return false;
    if (value.includes("\0")) return false;
    return true;
  }

  function normalizePushPayload(raw) {
    const notificationId = truncate(raw?.notificationId, 128) || "push-anonymous";
    const eventType = truncate(raw?.eventType, 64) || "push_message";
    const title = truncate(raw?.title, 64) || DEFAULT_TITLE;
    const body = truncate(raw?.body, 180) || DEFAULT_BODY;
    const hrefRaw = raw?.href == null ? FALLBACK_HREF : String(raw.href).trim();
    const href = isSafeRelativePath(hrefRaw) ? hrefRaw : FALLBACK_HREF;
    const tag = truncate(raw?.tag || `${eventType}:${notificationId}`, 128);

    return {
      notificationId,
      eventType,
      title,
      body,
      href,
      tag,
    };
  }

  function parsePushEventData(event) {
    if (!event?.data) {
      return normalizePushPayload({});
    }

    try {
      const json = event.data.json();
      if (json && typeof json === "object") {
        return normalizePushPayload(json);
      }
    } catch {
      // fall through to text parsing
    }

    try {
      const text = event.data.text();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          return normalizePushPayload(parsed);
        }
      }
    } catch {
      // ignore malformed payloads
    }

    return normalizePushPayload({});
  }

  function buildNotificationOptions(payload) {
    return {
      title: payload.title,
      options: {
        body: payload.body,
        tag: payload.tag,
        data: {
          notificationId: payload.notificationId,
          eventType: payload.eventType,
          href: payload.href,
        },
        icon: NOTIFICATION_ICON,
      },
    };
  }

  function resolveNotificationTarget(href, origin) {
    const safePath = isSafeRelativePath(href) ? href.trim() : FALLBACK_HREF;
    try {
      return new URL(safePath, origin).href;
    } catch {
      return new URL(FALLBACK_HREF, origin).href;
    }
  }

  async function handlePushEvent(event, registration) {
    const payload = parsePushEventData(event);
    const built = buildNotificationOptions(payload);
    await registration.showNotification(built.title, built.options);
  }

  async function handleNotificationClick(event, clientsApi, locationOrigin) {
    event.notification?.close?.();

    const rawHref = event.notification?.data?.href;
    const targetUrl = resolveNotificationTarget(rawHref, locationOrigin);
    const targetPath = isSafeRelativePath(rawHref) ? String(rawHref).trim() : FALLBACK_HREF;

    const windowClients = await clientsApi.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const client of windowClients) {
      if (!String(client.url || "").startsWith(locationOrigin)) continue;

      try {
        if ("navigate" in client) {
          await client.navigate(targetUrl);
          if ("focus" in client) {
            await client.focus();
          }
          return;
        }

        if ("focus" in client) {
          await client.focus();
        }

        if (typeof client.postMessage === "function") {
          client.postMessage({
            type: "bl-push-navigate",
            href: targetPath,
          });
          return;
        }
      } catch {
        // try next client or open a new window
      }
    }

    if (clientsApi.openWindow) {
      await clientsApi.openWindow(targetUrl);
    }
  }

  global.BL_PUSH = Object.freeze({
    DEFAULT_TITLE,
    DEFAULT_BODY,
    FALLBACK_HREF,
    NOTIFICATION_ICON,
    isSafeRelativePath,
    normalizePushPayload,
    parsePushEventData,
    buildNotificationOptions,
    resolveNotificationTarget,
    handlePushEvent,
    handleNotificationClick,
  });
})(self);
