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

  await page.goto("/calculators");
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("mandatory modules expose live data and calculator computation", async ({ page }) => {
  await page.goto("/map");
  const modules = await page.evaluate(async () => {
    const [map, reports, knowledge, calculators] = await Promise.all([
      fetch("/bff/api/v1/map/projects").then((r) => r.json()),
      fetch("/bff/api/v1/reports").then((r) => r.json()),
      fetch("/bff/api/v1/knowledge").then((r) => r.json()),
      fetch("/bff/api/v1/calculators").then((r) => r.json()),
    ]);
    const calculator = calculators[0];
    const definition = await fetch(`/bff/api/v1/calculators/${calculator.slug}`).then((r) => r.json());
    const values = Object.fromEntries(definition.inputs.map((field: { name: string; default?: number }) => [field.name, field.default ?? 1]));
    const result = await fetch(`/bff/api/v1/calculators/${calculator.slug}/compute`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ values }),
    }).then((r) => r.json());
    return { projects: map.projects.length, reports: reports.items.length, knowledge: knowledge.items.length, result: result.result };
  });
  expect(modules.projects).toBeGreaterThan(0);
  expect(modules.reports).toBeGreaterThan(0);
  expect(modules.knowledge).toBeGreaterThan(0);
  expect(Number.isFinite(modules.result)).toBeTruthy();
});

test("mobile Kazakh route has no horizontal overflow and keyboard focus works", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.addCookies([{ name: "locale", value: "kk", domain: "127.0.0.1", path: "/" }]);
  await page.goto("/map");
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await expect(page.getByRole("heading", { name: /Жобалар картасы/i })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).not.toBe("BODY");
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

for (const control of [
  { slug: "akk-animal", name: "животноводства", stage2: { collateral_type: "realestate", collateral_value: 20_000_000, annual_revenue: 50_000_000, cattle_supplier: "ТОО Поставщик" } },
  { slug: "brk-wagons-leasing", name: "вагонов", stage2: { annual_revenue: 500_000_000, collateral_type: "wagons", supplier_name: "ТОО Вагонмаш" } },
]) {
  test(`control case ${control.slug}: home → form → stage 2 → review`, async ({ page }) => {
    await loginDemo(page, "entrepreneur");
    await page.goto("/");
    const homeLink = page.locator(`a[href="/services/${control.slug}"]`).first();
    await expect(homeLink).toBeVisible();
    await homeLink.click();
    await expect(page.locator("h1").first()).toContainText(new RegExp(control.name, "i"));
    await page.getByRole("link", { name: "Подать заявку" }).click();
    await expect(page.getByRole("heading", { name: "Подача заявки" })).toBeVisible();
    await expect(page.getByText("Проверка и подпись")).toBeVisible();

    // Browser-session API submission keeps this E2E deterministic while the
    // SurveyJS field-level behaviour is covered by unit/API contract tests.
    const app = await page.evaluate(async ({ slug }) => {
      const service = await fetch(`/bff/api/v1/services/${slug}`).then((r) => r.json());
      const draft = await fetch("/bff/api/v1/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId: service.id, companyBin: "123456789012" }),
      }).then((r) => r.json());
      const submitted = await fetch(`/bff/api/v1/applications/${draft.id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: { bin: "123456789012", loan_amount: 10_000_000, cattle_amount: 8_000_000, wagon_count: 2, unit_price: 28_000_000 },
          consents: [true, true], signedBy: "Демо директор",
        }),
      }).then((r) => r.json());
      return submitted;
    }, { slug: control.slug });
    expect(app.status).toBe("stage2_required");

    await page.goto(`/cabinet/applications/${app.id}`);
    await expect(page.getByText("Дополнительные сведения и документы").first()).toBeVisible();

    const completed = await page.evaluate(async ({ id, answers }) => {
      return fetch(`/bff/api/v1/applications/${id}/stage2`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, signedBy: "Демо директор" }),
      }).then((r) => r.json());
    }, { id: app.id, answers: control.stage2 });
    expect(completed.status).toBe("in_review");
    await page.reload();
    await expect(page.getByText("На рассмотрении").first()).toBeVisible();

    await page.evaluate(async () => {
      await fetch("/api/auth/demo", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "admin" }),
      });
    });
    await page.goto("/admin/applications");
    await expect(page.getByText(app.number).first()).toBeVisible();
    const decision = await page.evaluate(async ({ id }) => {
      return fetch(`/bff/api/v1/admin/applications/${id}/transition`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: "approved" }),
      }).then((r) => r.json());
    }, { id: app.id });
    expect(decision.status).toBe("approved");
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
