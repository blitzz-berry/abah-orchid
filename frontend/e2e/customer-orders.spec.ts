import { expect, test } from "@playwright/test";
import { customerCredentials, loginViaUI } from "./helpers";

test.describe("customer orders smoke", () => {
  test("customer bisa membuka halaman orders bila kredensial e2e tersedia", async ({ page }) => {
    const customer = customerCredentials();
    test.skip(!customer.email || !customer.password, "Set ORCHIDMART_E2E_CUSTOMER_EMAIL dan ORCHIDMART_E2E_CUSTOMER_PASSWORD untuk smoke test halaman orders customer.");

    await loginViaUI(page, customer.email, customer.password);
    await page.waitForURL(/\/$/);

    await page.goto("/orders");
    await expect(page.locator("body")).toContainText(/Pesanan|Order/i);
  });
});
