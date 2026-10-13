import { test, expect, type Page } from "./fixtures";
import { pickOption } from "./mobile-controls";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const origin = process.env.TEST_API_ORIGIN || "http://localhost:8010/api/v1";
test.setTimeout(180000);
async function login(
  page: Page,
  platform = false,
  credentials?: { username: string; password: string },
) {
  page.setDefaultTimeout(15000);
  await page.goto(platform ? "/platform/login" : "/password-login");
  await page
    .getByLabel("Username or email", { exact: true })
    .fill(
      credentials?.username ||
        (platform
          ? process.env.PLATFORM_USERNAME!
          : process.env.RETAIL_USERNAME!),
    );
  await page
    .getByLabel("Password", { exact: true })
    .fill(
      credentials?.password ||
        (platform
          ? process.env.PLATFORM_PASSWORD!
          : process.env.RETAIL_PASSWORD!),
    );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(
    platform ? /platform\/dashboard$/ : /retail\/home$/,
  );
}
async function auth(page: Page) {
  const s = await page.evaluate(
    () => JSON.parse(localStorage.getItem("evolix-auth")!).state,
  );
  return {
    Authorization: "Bearer " + s.session_id, "X-CSRF-Token": s.csrf_token || "",
    "X-Company-Id": s.tenantContext?.company_id,
    "X-Branch-Id": s.tenantContext?.branch_id,
    "X-Financial-Year-Id": s.tenantContext?.financial_year_id,
  };
}
async function freshShop(page: Page, features: string[] = []) {
  await login(page, true);
  const headers = await auth(page),
    suffix = Date.now(),
    credentials = {
      username: "ux-" + suffix + "@test.invalid",
      password: "DisposableUX!" + suffix,
    };
  const r = await page.request.post(origin + "/platform/admin/tenants", {
    headers,
    data: {
      planId: process.env.TEST_NEW_TENANT_PLAN_ID, organizationName: "Retail UX " + suffix,
      adminName: "UX Owner",
      adminEmail: credentials.username,
      adminPassword: credentials.password,
    },
  });
  expect(r.status()).toBe(201);
  const tenant = await r.json();
  for (const feature_code of features) {
    const enabled = await page.request.post(
      origin + "/platform/admin/tenants/" + tenant.organization.id + "/actions",
      {
        headers,
        data: {
          action: "feature",
          feature_code,
          enabled: true,
          reason: "Disposable UX acceptance",
        },
      },
    );
    expect(enabled.status()).toBe(201);
  }
  await page.evaluate(() => localStorage.removeItem("evolix-auth"));
  await login(page, false, credentials);
  return tenant;
}

test("reference stock flow saves category/unit/description and supports low stock, selection, CSV and purchase actions", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const name = "UX Stock " + Date.now();
  await page.goto("/retail/items/add");
  await page.locator("#item-name-input").fill(name);
  await page.locator("#selling-price-input").fill("85");
  await page.locator("#opening-stock-input").fill("2");
  await page.locator("#more-details-toggle").click();
  await page.locator("#low-stock-alert-input").fill("3");
  await pickOption(page.locator("#item-unit"), "BOTTLE");
  await pickOption(page.locator("#item-category"), { label: "Soap & Shampoo" });
  await page
    .getByLabel("Description", { exact: false })
    .fill("Gentle shampoo, bottle");
  const saved = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/retail/items"),
  );
  await page.locator("#save-item-btn").click();
  const body = await (await saved).json();
  expect(body.unit).toBe("BOTTLE");
  expect(body.category).toBe("Soap & Shampoo");
  expect(body.custom_attributes.description).toBe("Gentle shampoo, bottle");
  await expect(page).toHaveURL(/retail\/items$/);
  await page.goto("/retail/stock?view=low");
  const tabs = page.getByRole("group", { name: "Stock status" });
  await expect(tabs.getByRole("button", {name:"Low Stock",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.locator("#item-search").fill(name);
  const card = page.locator("#item-" + body.id);
  await expect(card).toContainText("Low stock");
  await expect(card).toContainText("Minimum Level: 3");
  await page.locator('summary').filter({hasText:'Inventory tools'}).click();
  await page.getByRole("button", { name: "Select items", exact: true }).click();
  await card
    .getByRole("button", { name: "Select " + name, exact: true })
    .first()
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Selected", exact: true })
    .click();
  const file = await download;
  const csv = await readFile((await file.path())!, "utf8");
  expect(csv).toContain(name);
  expect(csv).toContain("BOTTLE");
  await page
    .getByRole("button", { name: "Finish selecting items", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Actions for " + name, exact: true })
    .click();
  await page.getByRole('dialog').getByRole("button", { name: "Buy Stock", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("purchases/new\\?item=" + body.id));
  await expect(page.locator("#purchase-item")).toHaveAttribute(
    "data-selection-value",
    body.id,
  );
  await page.goto("/retail/items/" + body.id);
  await expect(
    page.getByText("Gentle shampoo, bottle", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View Stock Movements", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(/OPENING|Opening/);
  await page.screenshot({
    path: info.outputPath("stock-movements.png"),
    fullPage: true,
  });
});

test("unit and category sheets support search, Escape, focus return, custom category and short-height accessibility", async ({
  page,
}, info) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 450 });
  await page.goto("/retail/items/add");
  const unit = page.locator("#item-unit");
  await unit.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByRole("searchbox").fill("sack");
  await expect(
    page.getByRole("option", { name: "Sack (SACK)", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(unit).toBeFocused();
  await page.locator("#more-details-toggle").click();
  await page.locator("#item-category").click();
  await page
    .getByRole("button", { name: "Add New Category", exact: true })
    .click();
  await page
    .getByLabel("Category name", { exact: true })
    .fill("Special Retail");
  await page.getByRole("button", { name: "Use Category", exact: true }).click();
  await expect(page.locator("#item-category")).toHaveText("Special Retail");
  await page.locator("#item-category").click();
  await expect(
    page.getByRole("option", { name: "Special Retail", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const scan = await new AxeBuilder({ page })
    .include(".r-mobile-sheet")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.filter((v) => ["critical", "serious"].includes(v.impact!)),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("category-short-height.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(page.locator("#item-category")).toHaveText("Select category");
});

test("staff management keeps real roles, grouped permissions, staff creation, edit, access and revocation inside Retail", async ({
  page,
}) => {
  await freshShop(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/retail/more/staff");
  const name = "Counter Team",
    role = "Counter Role";
  await page
    .getByRole("button", { name: "Roles & Permissions", exact: true })
    .click();
  await page.getByRole("button", { name: "Create Role", exact: true }).click();
  await page.getByLabel("Role name", { exact: true }).fill(role);
  await page
    .getByRole("button", { name: "Create Role", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button").filter({ hasText: role }).click();
  await expect(page.getByRole("checkbox").first()).toBeVisible();
  const permissionSaved = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/permissions"),
  );
  await page.getByRole("checkbox").first().check();
  expect((await permissionSaved).ok()).toBe(true);
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add Staff", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill(name);
  await page
    .getByLabel("Username", { exact: true })
    .fill("counter-" + Date.now());
  await page
    .getByLabel("Temporary password (12+ characters)", { exact: true })
    .fill("DisposableCounter!123");
  await page.getByRole("button", { name: "Save Staff", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Staff", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Actions for " + name, exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Details", exact: true }).click();
  await page.getByLabel("Phone (optional)", { exact: true }).fill("9876543210");
  await page.getByRole("button", { name: "Save Staff", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const staff = await page.request.get(origin + "/users?q=Counter%20Team", {
    headers: await auth(page),
  });
  expect(staff.status()).toBe(200);
  expect(
    (await staff.json()).find((u: any) => u.display_name === name).phone,
  ).toBe("9876543210");
  await page
    .getByRole("button", { name: "Actions for " + name, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reset Password", exact: true })
    .click();
  await page
    .getByLabel("New temporary password (12+ characters)", { exact: true })
    .fill("ResetCounter!123");
  const reset = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" && r.url().endsWith("/reset-password"),
  );
  await page
    .getByRole("button", { name: "Reset Password", exact: true })
    .click();
  expect((await reset).ok()).toBe(true);
  await expect(
    page.getByText(
      "Temporary password reset. Existing sessions were revoked.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Actions for " + name, exact: true })
    .click();
  await page.getByRole("button", { name: "Assign Roles", exact: true }).click();
  await page.getByRole("option", { name: role, exact: false }).click();
  await expect(
    page.getByRole("option", { name: role, exact: false }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Actions for " + name, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Disable Access", exact: true })
    .click();
  await expect(
    page.getByText("Staff access updated.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("article").filter({ hasText: name })).toContainText(
    "Disabled",
  );
  await page
    .getByRole("button", { name: "Actions for " + name, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Revoke Logged-in Devices", exact: true })
    .click();
  await expect(
    page.getByText("Staff devices revoked.", { exact: true }),
  ).toBeVisible();
});

test("enabled stock location uses sheets and authoritative transfer while total physical stock remains unchanged", async ({
  page,
}) => {
  await freshShop(page, ["MULTIPLE_STOCK_LOCATIONS"]);
  await page.setViewportSize({ width: 390, height: 844 });
  const headers = await auth(page);
  const created = await page.request.post(origin + "/retail/items", {
    headers,
    data: { name: "Transfer Test", selling_price: 100, opening_stock: 10 },
  });
  expect(created.status()).toBe(201);
  const item = await created.json();
  await page.goto("/retail/more/locations");
  await page
    .getByRole("button", { name: "Add Stock Location", exact: true })
    .click();
  await page.getByLabel("Location name *", { exact: true }).fill("Back Room");
  await page.getByLabel("Location code *", { exact: true }).fill("BACK");
  await page
    .getByRole("button", { name: "Save Stock Location", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Back Room", exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Transfer Stock", exact: true })
    .click();
  await pickOption(page.getByLabel("To Location", { exact: true }), {
    label: "Back Room",
  });
  await pickOption(page.locator("#purchase-item"), { label: "Transfer Test" });
  await page.getByLabel("Quantity", { exact: false }).fill("3");
  const moved = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().endsWith("/inventory/transfers"),
  );
  await page
    .getByRole("button", { name: "Confirm Transfer", exact: true })
    .click();
  expect((await moved).ok()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const r = await page.request.get(
    origin + "/inventory/stock?item_id=" + item.id,
    { headers },
  );
  expect(r.status()).toBe(200);
  const stock = await r.json();
  expect(stock.reduce((s: number, v: any) => s + Number(v.quantity), 0)).toBe(
    10,
  );
  expect(
    stock
      .map((v: any) => Number(v.quantity))
      .sort((a: number, b: number) => a - b),
  ).toEqual([3, 7]);
});

for (const [width, height] of [
  [360, 800],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1280, 900],
])
  test(
    "Retail visual acceptance light/dark " + width,
    async ({ page }, info) => {
      await page.setViewportSize({ width, height });
      await login(page);
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => {
          localStorage.setItem("evolix-theme", value);
          window.dispatchEvent(new Event("evolix-theme"));
        }, theme);
        for (const route of [
          "home",
          "items",
          "stock?view=low",
          "items/add",
          "bill",
          "quick-sale",
          "udhar",
          "purchases/new",
          "suppliers",
          "khata",
          "expenses",
          "expenses/add",
          "needs",
          "galla",
          "reports",
          "more",
          "more/settings",
          "more/staff",
          "more/locations",
          "assistant",
        ]) {
          await page.goto("/retail/" + route);
          // This route sweep generates far more requests than a human operator.
          // Keep the real production report quota active and pace the sweep.
          await page.waitForTimeout(1500);
          await expect(page.locator("#retail-page-content")).not.toBeEmpty();
          await expect(page.getByRole("status").filter({hasText:/Loading|Preparing/})).toHaveCount(0, {
            timeout: 10000,
          });
          await expect(page.locator("#retail-page-content select")).toHaveCount(
            0,
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            theme + " " + route,
          ).toBe(true);
          if (route === "khata") {
            const cards = page.locator("button.r-list-item");
            const clipped = await cards.evaluateAll((elements) =>
              elements.some((element) => {
                const card = element.getBoundingClientRect();
                const amount = element
                  .querySelector(".r-list-item-amount")
                  ?.getBoundingClientRect();
                return (
                  card.right > innerWidth ||
                  card.left < 0 ||
                  (!!amount &&
                    (amount.right > card.right || amount.left < card.left))
                );
              }),
            );
            expect(clipped, theme + " customer amount clipping").toBe(false);
            const scan = await new AxeBuilder({ page })
              .include("#retail-page-content")
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze();
            expect(
              scan.violations.filter((v) =>
                ["critical", "serious"].includes(v.impact!),
              ),
            ).toEqual([]);
          }
          if (
            width === 390 ||
            [
              "home",
              "stock?view=low",
              "items/add",
              "reports",
              "more",
              "expenses/add",
            ].includes(route)
          )
            await page.screenshot({
              path: info.outputPath(
                theme +
                  "-" +
                  route.replace(/[/?=]/g, "-") +
                  "-" +
                  width +
                  ".png",
              ),
              fullPage: true,
            });
        }
        await page.goto("/retail/items/add");
        await page.locator("#item-unit").click();
        await expect(page.getByRole("option").first()).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(theme + "-unit-sheet-" + width + ".png"),
          fullPage: true,
        });
        await page.keyboard.press("Escape");
      }
    },
  );

test.describe("deferred first-login welcome", () => {
  test.use({ migrationPrompt: false });
  test("late import prompt waits for Home without blocking an active billing sheet", async ({
    page,
  }, info) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/retail/account/migration", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    });
    try {
      await freshShop(page);
      await page.goto("/retail/bill");
      await page
        .locator("#item-search-input")
        .fill("Unknown welcome test item");
      await expect(page.getByRole("dialog")).toHaveCount(1);
      const migrationRead = page.waitForResponse(
        (r) =>
          r.request().method() === "GET" &&
          r.url().endsWith("/retail/account/migration"),
      );
      release();
      await migrationRead;
      const welcome = page.getByRole("dialog", {
        name: "Welcome to your EVOLIX shop",
        exact: true,
      });
      await expect(welcome).toHaveCount(0);
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
        "hidden",
      );
      await page.goto("/retail/home");
      await expect(welcome).toBeVisible();
      await page.screenshot({ path: info.outputPath("deferred-welcome.png") });
      await welcome
        .getByRole("button", { name: "Start fresh", exact: true })
        .click();
      await expect(welcome).toHaveCount(0);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const saved = await page.request.get(
        origin + "/retail/account/migration",
        { headers: await auth(page) },
      );
      expect(saved.status()).toBe(200);
      expect((await saved.json()).choice).toBe("FRESH");
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
        "hidden",
      );
    } finally {
      release();
    }
  });
});

test("Udhar payment searches customers beyond the first page and posts the selected customer credit", async ({
  page,
}, info) => {
  await freshShop(page);
  const headers = await auth(page);
  for (let index = 0; index < 100; index++) {
    const response = await page.request.post(origin + "/retail/customers", {
      headers,
      data: { name: "A Counter " + String(index).padStart(3, "0") },
    });
    expect(response.status()).toBe(201);
  }
  const response = await page.request.post(origin + "/retail/customers", {
    headers,
    data: { name: "Z Customer Beyond Page", mobile: "9876543210" },
  });
  expect(response.status()).toBe(201);
  const customer = await response.json();
  const item = await page.request.post(origin + "/retail/items", {
    headers,
    data: {
      name: "Udhar Search Goods",
      selling_price: 150,
      inventory_tracking: false,
    },
  });
  expect(item.status()).toBe(201);
  await page.goto("/retail/bill");
  await page.locator("#item-search-input").fill("Udhar Search Goods");
  await page
    .getByRole("button")
    .filter({ hasText: "Udhar Search Goods" })
    .first()
    .click();
  await page.locator("#pay-btn").click();
  await page.locator("#pay-udhar").click();
  await page.getByRole("searchbox").fill("Z Customer Beyond Page");
  const option = page.getByRole("option", { name: /Z Customer Beyond Page/ });
  await expect(option).toBeVisible();
  await page.screenshot({ path: info.outputPath("udhar-customer-search.png") });
  await option.click();
  await expect(page.locator("#save-as-udhar")).toBeEnabled();
  const saved = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/retail/bills"),
  );
  await page.locator("#save-as-udhar").click();
  expect((await saved).status()).toBe(201);
  await expect(page).toHaveURL(/sale-complete$/);
  const outstanding = await page.request.get(
    origin + "/retail/customers/" + customer.id + "/khata",
    { headers },
  );
  expect(outstanding.status()).toBe(200);
  expect(Number((await outstanding.json()).balance)).toBe(150);
});

test("Khata pending-dues empty state offers a working route back to customers", async ({
  page,
}) => {
  await freshShop(page);
  const name = "Customer with no outstanding amount";
  const created = await page.request.post(origin + "/retail/customers", {
    headers: await auth(page),
    data: { name },
  });
  expect(created.status()).toBe(201);
  await page.goto("/retail/khata");
  await expect(
    page.getByRole("button", { name: "Open " + name, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Pending dues only", exact: true })
    .check();
  await expect(
    page.getByRole("heading", {
      name: "No pending customer dues",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show All Customers", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open " + name, exact: true }),
  ).toBeVisible();
  await page.locator("#khata-search").fill("No such customer");
  await expect(
    page.getByRole("heading", { name: "No customers found", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Customer", exact: true }).last().click();
  await expect(page).toHaveURL(/retail\/customers\/add$/);
});
