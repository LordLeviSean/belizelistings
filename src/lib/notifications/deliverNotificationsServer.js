/**
 * Server-only notification delivery hooks that attach Web Push after in-app delivery.
 * Import only from API routes, cron handlers, or other server-only modules.
 */

import { maybeDeliverNewInquiryWebPush } from "../push/deliverNewInquiryWebPush";
import {
  deliverNotificationQueueItem,
  processNotificationQueueBatch,
} from "./deliverNotifications";

async function afterNotificationDelivered(client, deliverData) {
  if (!client || !deliverData || deliverData.skipped) {
    return;
  }
  await maybeDeliverNewInquiryWebPush(client, deliverData);
}

async function afterBatchDelivered(client, batchData) {
  const results = batchData?.results;
  if (!client || !Array.isArray(results) || !results.length) {
    return;
  }
  for (const item of results) {
    if (item?.skipped) continue;
    await maybeDeliverNewInquiryWebPush(client, item);
  }
}

export async function deliverNotificationQueueItemWithPush(client, queueId) {
  const result = await deliverNotificationQueueItem(client, queueId);
  if (result.ok && result.data && !result.data.skipped) {
    await afterNotificationDelivered(client, result.data);
  }
  return result;
}

export async function processNotificationQueueBatchWithPush(client, options) {
  const result = await processNotificationQueueBatch(client, options);
  if (result.ok && result.data) {
    await afterBatchDelivered(client, result.data);
  }
  return result;
}

export async function triggerNotificationDeliveryWithPush(client, { limit = 50 } = {}) {
  return processNotificationQueueBatchWithPush(client, { limit });
}
