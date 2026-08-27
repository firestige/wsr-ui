import { expect, test } from "@playwright/test";

test("semantic preview works by keyboard in both themes", async ({ page }) => {
  await page.goto("/preview");
  await expect(
    page.getByRole("heading", { name: "BI visual system" }),
  ).toBeVisible();

  await page.getByLabel("Theme").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByLabel("Density").focus();
  await page.keyboard.press("c");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await expect(
    page.getByRole("img", { name: "Recorded trace preview" }),
  ).toBeVisible();
});
