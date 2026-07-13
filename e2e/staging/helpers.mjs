import { expect } from "@playwright/test";

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function signIn(page, email, password) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 60_000 });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} listingId
 * @param {string} messageBody
 */
export async function sendListingMessage(page, listingId, messageBody) {
  await page.goto(`/listing/${listingId}`);
  await page.getByRole("button", { name: "Contact agent" }).click();
  await page.getByRole("button", { name: "Message via BelizeListings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder(/Introduce yourself/i).fill(messageBody);
  await dialog.getByRole("button", { name: "Send message" }).click();
  await expect(page).toHaveURL(/tab=messages/, { timeout: 60_000 });
  const match = page.url().match(/conversation=([^&]+)/);
  return match?.[1] || null;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} conversationId
 * @param {string} replyBody
 */
export async function ownerReplyInInbox(page, conversationId, replyBody) {
  await page.goto(`/dashboard/user?tab=owner-inbox&conversation=${conversationId}`);
  await page.locator("#owner-inbox-reply").fill(replyBody);
  await page.getByRole("button", { name: "Send reply" }).click();
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function openNotificationsPanel(page) {
  const bell = page.getByRole("button", { name: /Notifications/i });
  if (await bell.isVisible().catch(() => false)) {
    await bell.click();
    return page.getByRole("dialog", { name: /Operational updates/i });
  }
  await page.getByRole("button", { name: /Account/i }).click();
  const drawer = page.locator("#site-nav-mobile-drawer");
  await drawer.getByRole("button", { name: /Notifications/i }).click();
  return page.getByRole("dialog", { name: /Operational updates/i });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} listingId
 */
export async function requestViewing(page, listingId) {
  await page.goto(`/listing/${listingId}`);
  await page.getByRole("button", { name: "Schedule viewing" }).click();
  await page.getByRole("button", { name: "Select a date" }).click();
  const cal = page.getByRole("dialog", { name: "Choose date" });
  const dayBtn = cal.locator("button").filter({ hasNotText: /^(Previous|Next)/ }).nth(2);
  await dayBtn.click();
  await page.locator("#booking-time-select").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Confirm viewing" }).click();
  await page.getByRole("button", { name: "Done" }).click();
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function waitForViewingInOwnerPanel(page) {
  await page.goto("/dashboard/user?tab=owner-viewings");
  await expect(page.getByRole("feed", { name: "Viewing requests" })).toBeVisible();
}

/**
 * Unique message body for test isolation.
 */
export function uniqueBody(prefix) {
  return `${prefix} ${Date.now()}`;
}
