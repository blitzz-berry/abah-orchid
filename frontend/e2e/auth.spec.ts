import { expect, test } from "@playwright/test";
import { adminCredentials, customerCredentials, expectLoggedIn, loginViaUI } from "./helpers";

test.describe("auth smoke", () => {
  test("admin bisa login dan masuk ke dashboard admin", async ({ page }) => {
    const creds = adminCredentials();

    await loginViaUI(page, creds.email, creds.password);
    await expectLoggedIn(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("halaman lupa password menampilkan hasil submit", async ({ page }) => {
    const customer = customerCredentials();
    const email = customer.email || adminCredentials().email;

    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Lupa Kata Sandi" })).toBeVisible();

    await page.locator('input[type="email"]').fill(email);
    const submitButton = page.getByRole("button", { name: "Kirim Tautan Reset", exact: true });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(
      page.getByText(/Email Terkirim|Tautan Pengaturan Ulang Dibuat/i),
    ).toBeVisible();
  });

  test("customer bisa login kalau kredensial e2e disediakan", async ({ page }) => {
    const customer = customerCredentials();
    test.skip(!customer.email || !customer.password, "Set ORCHIDMART_E2E_CUSTOMER_EMAIL dan ORCHIDMART_E2E_CUSTOMER_PASSWORD untuk flow customer login.");

    await loginViaUI(page, customer.email, customer.password);
    await expectLoggedIn(page);
    await expect(page).toHaveURL(/\/$/);
  });
});
