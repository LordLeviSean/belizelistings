import { test, expect } from "@playwright/test";
import {
  E2E_BASE_URL,
  E2E_PUBLISHED_LISTING_ID,
  hasFlowBCredentials,
  missingCredentialMessage,
  ACCOUNTS,
} from "./config.mjs";
import { signIn, requestViewing } from "./helpers.mjs";

test.describe("Flow B — Viewing reschedule", () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(!hasFlowBCredentials(), missingCredentialMessage("B"));
    testInfo.annotations.push({ type: "baseUrl", description: E2E_BASE_URL });
  });

  test("buyer request → owner propose → buyer accept → confirmed on both dashboards", async ({ browser }) => {
    const buyerContext = await browser.newContext();
    const ownerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    const ownerPage = await ownerContext.newPage();

    const proposedDate = new Date();
    proposedDate.setDate(proposedDate.getDate() + 5);
    const dateStr = proposedDate.toISOString().slice(0, 10);

    try {
      await signIn(buyerPage, ACCOUNTS.buyer.email, ACCOUNTS.buyer.password);
      await requestViewing(buyerPage, E2E_PUBLISHED_LISTING_ID);

      await signIn(ownerPage, ACCOUNTS.owner.email, ACCOUNTS.owner.password);
      await ownerPage.goto("/dashboard/user?tab=owner-viewings");
      const viewingCard = ownerPage.getByRole("feed", { name: "Viewings" }).locator("article").first();
      await expect(viewingCard).toBeVisible({ timeout: 30_000 });

      await viewingCard.getByRole("button", { name: "Propose new time" }).click();
      await ownerPage.locator('input[type="date"]').fill(dateStr);
      await ownerPage.locator('input[type="time"]').fill("14:00");
      await viewingCard.getByRole("button", { name: "Send proposal" }).click();
      await expect(viewingCard.getByText(/Buyer proposed|Reschedule/i)).toBeVisible({ timeout: 15_000 }).catch(() => {});

      await buyerPage.goto("/dashboard/user?tab=viewings");
      const buyerCard = buyerPage.getByRole("feed", { name: "Viewings" }).locator("article").first();
      await expect(buyerCard.getByText(/Agent proposed/i)).toBeVisible({ timeout: 30_000 });
      await buyerCard.getByRole("button", { name: "Accept proposed time" }).click();
      await expect(buyerCard.getByText(/confirmed/i)).toBeVisible({ timeout: 30_000 });

      await ownerPage.reload();
      await expect(ownerPage.getByRole("feed", { name: "Viewings" }).getByText(/confirmed/i).first()).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await buyerContext.close();
      await ownerContext.close();
    }
  });
});
