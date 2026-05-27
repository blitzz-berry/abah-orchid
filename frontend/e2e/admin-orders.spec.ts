import { expect, test } from "@playwright/test";
import { adminCredentials, loginViaUI } from "./helpers";

test.describe("admin orders smoke", () => {
  test("admin bisa membuka dashboard pesanan", async ({ page }) => {
    const creds = adminCredentials();

    await loginViaUI(page, creds.email, creds.password);
    await page.waitForURL(/\/admin$/);

    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Manajemen Pesanan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Daftar Pesanan" })).toBeVisible();
    await expect(page.getByPlaceholder("Cari order/nama...")).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });
});
