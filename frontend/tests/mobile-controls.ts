import { expect, type Locator } from "@playwright/test";
/** Operates the visible choice UI. Legacy platform selects remain native. */
export async function pickOption(
  control: Locator,
  choice: string | { label?: string; value?: string; index?: number },
): Promise<string[]> {
  await expect(control).toBeVisible();
  if (await control.evaluate((e) => e.tagName === "SELECT"))
    return control.selectOption(choice);
  const value = typeof choice === "string" ? choice : choice.value,
    label = typeof choice === "object" ? choice.label : undefined,
    index = typeof choice === "object" ? choice.index : undefined;
  const direct = control.locator("[data-choice-value]");
  if (await direct.count()) {
    const target =
      value !== undefined
        ? direct.locator('xpath=self::*[@data-choice-value="' + value + '"]')
        : label
          ? control.getByRole("button", { name: label, exact: true })
          : direct.nth(index || 0);
    await target.click();
    return value !== undefined
      ? [value]
      : [(await target.getAttribute("data-choice-value"))!];
  }
  await control.click();
  const page = control.page(),
    dialog = page.getByRole("dialog").last();
  if (label) await dialog.getByRole("searchbox").fill(label);
  let target =
    value !== undefined
      ? dialog
          .locator("[role=option]")
          .locator('xpath=self::*[@data-choice-value="' + value + '"]')
      : label
        ? dialog.getByRole("option").filter({ hasText: label })
        : dialog.getByRole("option").nth(index || 0);
  for (let i = 0; i < 30; i++) {
    await expect(dialog.getByRole("status")).toHaveCount(0, { timeout: 15000 });
    if (await target.count()) break;
    const more = dialog.getByRole("button", { name: "Load More", exact: true });
    if (!(await more.isVisible())) break;
    await more.click();
  }
  await expect(target.first()).toBeVisible();
  const selected = (await target.first().getAttribute("data-choice-value"))!;
  await target.first().click();
  return [selected];
}
