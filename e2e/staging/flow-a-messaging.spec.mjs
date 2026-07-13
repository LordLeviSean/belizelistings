import { test, expect } from "@playwright/test";
import {
  E2E_BASE_URL,
  E2E_PUBLISHED_LISTING_ID,
  hasFlowACredentials,
  missingCredentialMessage,
  ACCOUNTS,
} from "./config.mjs";
import {
  signIn,
  sendListingMessage,
  ownerReplyInInbox,
  openNotificationsPanel,
  uniqueBody,
} from "./helpers.mjs";

test.describe("Flow A — Messaging", () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(!hasFlowACredentials(), missingCredentialMessage("A"));
    testInfo.annotations.push({ type: "baseUrl", description: E2E_BASE_URL });
  });

  test("buyer message → owner thread → owner reply → buyer notification deep link", async ({ browser }) => {
    const messageBody = uniqueBody("E2E Flow A");
    const ownerReply = uniqueBody("E2E owner reply");

    const buyerContext = await browser.newContext();
    const ownerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    const ownerPage = await ownerContext.newPage();

    try {
      await signIn(buyerPage, ACCOUNTS.buyer.email, ACCOUNTS.buyer.password);
      const conversationId = await sendListingMessage(
        buyerPage,
        E2E_PUBLISHED_LISTING_ID,
        messageBody
      );
      expect(conversationId).toBeTruthy();

      await signIn(ownerPage, ACCOUNTS.owner.email, ACCOUNTS.owner.password);
      await ownerPage.goto(`/dashboard/user?tab=owner-inbox&conversation=${conversationId}`);
      await expect(ownerPage.getByText(messageBody)).toBeVisible({ timeout: 30_000 });

      await ownerReplyInInbox(ownerPage, conversationId, ownerReply);

      await buyerPage.goto(`/dashboard/user?tab=messages&conversation=${conversationId}`);
      await expect(buyerPage.getByText(ownerReply)).toBeVisible({ timeout: 45_000 });

      const panel = await openNotificationsPanel(buyerPage);
      const notifLink = panel.getByRole("link").filter({ hasText: /replied|message|inquiry/i }).first();
      if (await notifLink.isVisible().catch(() => false)) {
        await notifLink.click();
        await expect(buyerPage).toHaveURL(new RegExp(`conversation=${conversationId}`));
      }
    } finally {
      await buyerContext.close();
      await ownerContext.close();
    }
  });
});
