import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function loginDemo(page: import("@playwright/test").Page, role: "admin" | "entrepreneur") {
  await page.goto("/login");
  await page.getByRole("button", { name: role === "admin" ? "Администратор" : "Предприниматель" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("public routes render and catalog loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Все меры поддержки бизнеса — в одном портале" })).toBeVisible();

  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "Каталог услуг" })).toBeVisible();

  await page.goto("/services/akk-animal");
  await expect(page.locator("h1").first()).toContainText("животноводства");

  await page.goto("/knowledge");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await page.goto("/map");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("admin import pipeline runs and creates a draft", async ({ page }) => {
  await loginDemo(page, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Обзор" })).toBeVisible();

  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await page.goto("/admin/integrations");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await page.goto("/admin/applications");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await page.goto("/admin/services");
  await expect(page.getByRole("heading", { name: "Реестр услуг" })).toBeVisible();

  await page.goto("/admin/imports");
  await expect(page.getByRole("heading", { name: "Импорт мер поддержки" })).toBeVisible();
  await expect(page.getByText("bgov.kz")).toBeVisible();

  const bgovCard = page.locator(".rounded-control").filter({
    has: page.getByText("bgov.kz"),
  }).first();

  await expect(bgovCard.getByRole("button", { name: "Обновить сейчас" })).toBeVisible();

  const refreshPromise = page.waitForResponse(
    (resp) =>
      resp.request().method() === "POST" &&
      resp.url().includes("/api/v1/admin/imports/bgov/run") &&
      resp.status() === 200
  );
  await bgovCard.getByRole("button", { name: "Обновить сейчас" }).click();
  await refreshPromise;
  await page.reload();

  const payload = (await page.evaluate(async () => {
    const res = await fetch("/bff/api/v1/admin/imports", { cache: "no-store" });
    return res.json();
  })) as {
    services: Array<{ id: string; serviceSlug: string; title: string }>;
  };
  const target = payload.services.find((item) => !item.serviceSlug);
  expect(target).toBeTruthy();
  const serviceButton = page.getByRole("button", {
    name: new RegExp(escapeRegExp(target!.title)),
  }).first();
  await serviceButton.click();

  const createDraft = page.getByRole("button", { name: "Создать черновик" });
  await expect(createDraft).toBeVisible();
  await createDraft.click();

  await expect(page).toHaveURL(/\/admin\/services\/svc_/);
  await expect(page.getByRole("tab", { name: "Карточка" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Форма заявки" })).toBeVisible();
});

test("entrepreneur cabinet opens", async ({ page }) => {
  await loginDemo(page, "entrepreneur");
  await page.goto("/cabinet");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await page.goto("/cabinet/notifications");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await page.goto("/cabinet/applications");
  await expect(page.getByRole("heading").first()).toBeVisible();
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
