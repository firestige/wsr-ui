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

  const explanation = page.getByRole("button", {
    name: "Preview metric explanation",
  });
  await explanation.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Metric explanation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(explanation).toBeFocused();
});

test("platform reduced motion forces the Still preview", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview");

  await expect(page.getByText("Mode: Still")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start Live reading" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Reduced motion keeps the complete structure still/i),
  ).toBeVisible();
});
