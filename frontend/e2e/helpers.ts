import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

type EnvMap = Record<string, string>;

let cachedBackendEnv: EnvMap | null = null;

function loadBackendEnv(): EnvMap {
  if (cachedBackendEnv) return cachedBackendEnv;

  const envPath = path.resolve(process.cwd(), "../backend/.env");
  const result: EnvMap = {};

  if (!fs.existsSync(envPath)) {
    cachedBackendEnv = result;
    return result;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    result[key] = value;
  }

  cachedBackendEnv = result;
  return result;
}

export function adminCredentials() {
  const backendEnv = loadBackendEnv();
  return {
    email: process.env.ORCHIDMART_E2E_ADMIN_EMAIL || backendEnv.ADMIN_EMAIL || "admin@orchidmart.local",
    password: process.env.ORCHIDMART_E2E_ADMIN_PASSWORD || backendEnv.ADMIN_PASSWORD || "Admin123!",
  };
}

export function customerCredentials() {
  return {
    email: process.env.ORCHIDMART_E2E_CUSTOMER_EMAIL || "",
    password: process.env.ORCHIDMART_E2E_CUSTOMER_PASSWORD || "",
  };
}

export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Selamat Datang Kembali" })).toBeVisible();

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const submitButton = page.getByRole("button", { name: "Masuk", exact: true });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
}

export async function expectLoggedIn(page: Page) {
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  await expect(page.locator("body")).not.toContainText("Masuk gagal");
}
