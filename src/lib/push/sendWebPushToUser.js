import webpush from "web-push";
import { readWebPushVapidConfig } from "./webPushVapidConfig";
import { serializePushPayload } from "./pushPayload";
import {
  classifyPushHttpStatus,
  mapOutcomeToSubscriptionRecord,
  shouldDeactivateSubscription,
} from "./pushDeliveryClassification";

const DEFAULT_CONCURRENCY = 4;

/**
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<void>} worker
 */
async function forEachWithConcurrency(items, limit, worker) {
  if (!items.length) return;
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} userId
 * @param {{ maxSubscriptions?: number|null }} [options]
 */
async function loadActivePushSubscriptions(adminClient, userId, { maxSubscriptions } = {}) {
  const nowIso = new Date().toISOString();
  let query = adminClient
    .from("push_subscriptions")
    .select(
      "id, user_id, endpoint, p256dh, auth_secret, expiration_time, platform_label, consecutive_failures, updated_at"
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .is("revoked_at", null)
    .or(`expiration_time.is.null,expiration_time.gt.${nowIso}`)
    .order("updated_at", { ascending: false });

  if (Number.isFinite(maxSubscriptions) && maxSubscriptions > 0) {
    query = query.limit(Math.floor(maxSubscriptions));
  }

  const { data, error } = await query;
  if (error) {
    return { rows: [], error };
  }

  const rows = (Array.isArray(data) ? data : []).map((row) => ({
    subscription_id: row.id,
    user_id: row.user_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth_secret: row.auth_secret,
    expiration_time: row.expiration_time,
    platform_label: row.platform_label,
    consecutive_failures: row.consecutive_failures,
    updated_at: row.updated_at,
  }));

  return { rows, error: null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} userId
 * @param {{ ok: true, payload: object } | { ok: false, error: string }} builtPayload
 * @param {{ concurrency?: number, maxSubscriptions?: number|null }} [options]
 */
export async function sendWebPushToUser(adminClient, userId, builtPayload, options = {}) {
  if (!adminClient?.from || !userId) {
    return {
      ok: false,
      error: "invalid_arguments",
      attempted: 0,
      delivered: 0,
      temporaryFailures: 0,
      deactivated: 0,
    };
  }

  if (!builtPayload?.ok || !builtPayload.payload) {
    return {
      ok: false,
      error: builtPayload?.error || "invalid_payload",
      attempted: 0,
      delivered: 0,
      temporaryFailures: 0,
      deactivated: 0,
    };
  }

  const vapid = readWebPushVapidConfig();
  if (!vapid.configured) {
    return {
      ok: false,
      error: "vapid_not_configured",
      attempted: 0,
      delivered: 0,
      temporaryFailures: 0,
      deactivated: 0,
    };
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const maxSubscriptions =
    Number.isFinite(options.maxSubscriptions) && options.maxSubscriptions > 0
      ? Math.floor(options.maxSubscriptions)
      : null;

  let rows = [];
  if (maxSubscriptions != null) {
    const loaded = await loadActivePushSubscriptions(adminClient, userId, { maxSubscriptions });
    if (loaded.error) {
      return {
        ok: false,
        error: "subscription_lookup_failed",
        attempted: 0,
        delivered: 0,
        temporaryFailures: 0,
        deactivated: 0,
      };
    }
    rows = loaded.rows;
  } else {
    const { data: subscriptions, error: selectError } = await adminClient.rpc(
      "select_active_push_subscriptions_for_delivery",
      { p_user_id: userId }
    );

    if (selectError) {
      return {
        ok: false,
        error: "subscription_lookup_failed",
        attempted: 0,
        delivered: 0,
        temporaryFailures: 0,
        deactivated: 0,
      };
    }

    rows = Array.isArray(subscriptions) ? subscriptions : [];
  }

  if (!rows.length) {
    return {
      ok: false,
      error: "no_active_subscriptions",
      attempted: 0,
      delivered: 0,
      temporaryFailures: 0,
      deactivated: 0,
    };
  }

  const payloadJson = serializePushPayload(builtPayload);
  if (!payloadJson) {
    return {
      ok: false,
      error: "invalid_payload",
      attempted: 0,
      delivered: 0,
      temporaryFailures: 0,
      deactivated: 0,
    };
  }

  const summary = {
    ok: true,
    attempted: rows.length,
    delivered: 0,
    temporaryFailures: 0,
    deactivated: 0,
  };

  const concurrency = Math.max(1, Number(options.concurrency) || DEFAULT_CONCURRENCY);

  await forEachWithConcurrency(rows, concurrency, async (row) => {
    const subscriptionId = row.subscription_id;
    const pushSubscription = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth_secret,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, payloadJson);
      const classification = classifyPushHttpStatus(200);
      const recordOutcome = mapOutcomeToSubscriptionRecord(classification.outcome);
      if (recordOutcome) {
        await adminClient.rpc("record_push_subscription_delivery", {
          p_subscription_id: subscriptionId,
          p_outcome: recordOutcome,
        });
      }
      summary.delivered += 1;
    } catch (error) {
      const status = Number(error?.statusCode);
      const classification = classifyPushHttpStatus(status);
      const recordOutcome = mapOutcomeToSubscriptionRecord(classification.outcome);

      if (recordOutcome) {
        await adminClient.rpc("record_push_subscription_delivery", {
          p_subscription_id: subscriptionId,
          p_outcome: recordOutcome,
        });
        if (recordOutcome === "temporary_failure") {
          summary.temporaryFailures += 1;
        }
      }

      if (shouldDeactivateSubscription(classification.outcome)) {
        const { data: deactivateResult } = await adminClient.rpc(
          "deactivate_push_subscription",
          {
            p_subscription_id: subscriptionId,
            p_reason: classification.outcome,
          }
        );
        if (deactivateResult?.deactivated) {
          summary.deactivated += 1;
        }
      }
    }
  });

  summary.ok = summary.delivered > 0;
  if (!summary.ok && summary.attempted > 0) {
    summary.error = "delivery_failed";
  }

  return summary;
}
