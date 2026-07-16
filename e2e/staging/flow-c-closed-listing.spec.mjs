import { test, expect } from "@playwright/test";
import {
  E2E_BASE_URL,
  E2E_CLOSABLE_LISTING_ID,
  hasFlowCCredentials,
  missingCredentialMessage,
  ACCOUNTS,
} from "./config.mjs";
import { signIn } from "./helpers.mjs";

test.describe("Flow C — Closed listing", () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(!hasFlowCCredentials(), missingCredentialMessage("C"));
    testInfo.annotations.push({ type: "baseUrl", description: E2E_BASE_URL });
  });

  test("owner marks recently sold → public card updates → engagement blocked → history preserved", async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const buyerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const buyerPage = await buyerContext.newPage();

    try {
      await signIn(ownerPage, ACCOUNTS.owner.email, ACCOUNTS.owner.password);
      await ownerPage.goto("/dashboard/user?tab=my-listings");
      const row = ownerPage.locator(`article, [data-listing-id="${E2E_CLOSABLE_LISTING_ID}"]`).first();
      await row.getByRole("button", { name: /Mark Sold|Mark Rented/i }).first().click();
      await ownerPage.getByRole("button", { name: /Mark Recently/i }).click();

      await buyerPage.goto(`/listing/${E2E_CLOSABLE_LISTING_ID}`);
      await expect(buyerPage.getByText(/RECENTLY SOLD|RECENTLY RENTED/i)).toBeVisible({ timeout: 30_000 });

      const contactBtn = buyerPage.getByRole("button", { name: "Contact agent" });
      await expect(contactBtn).toBeDisabled();

      if (ACCOUNTS.buyer.email) {
        await signIn(buyerPage, ACCOUNTS.buyer.email, ACCOUNTS.buyer.password);
        await buyerPage.goto("/dashboard/user?tab=messages");
        await expect(buyerPage.getByRole("list", { name: "Your conversations" })).toBeVisible();
      }
    } finally {
      await ownerContext.close();
      await buyerContext.close();
    }
  });
});
