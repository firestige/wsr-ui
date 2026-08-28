import { expect, test } from "@playwright/test";

test("semantic preview works by keyboard in both themes", async ({ page }) => {
  await page.goto("/preview");
  await expect(
    page.getByRole("heading", { name: "BI visual system" }),
  ).toBeVisible();

  await page.getByLabel("Theme").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightTruth = await page
    .getByRole("region", { name: "Metric truth states" })
    .innerText();
  const lightRoles = await page.evaluate(() => {
    const root = getComputedStyle(document.querySelector("main")!);
    const status = getComputedStyle(
      document.querySelector(".status-available")!,
    );
    return {
      foreground: root.color,
      background: root.backgroundColor,
      statusForeground: status.color,
      statusBackground: status.backgroundColor,
    };
  });

  await page.getByLabel("Theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.getByRole("region", { name: "Metric truth states" }).innerText(),
  ).toBe(lightTruth);
  const darkRoles = await page.evaluate(() => {
    const root = getComputedStyle(document.querySelector("main")!);
    const status = getComputedStyle(
      document.querySelector(".status-available")!,
    );
    return {
      foreground: root.color,
      background: root.backgroundColor,
      statusForeground: status.color,
      statusBackground: status.backgroundColor,
    };
  });
  expect(darkRoles).not.toEqual(lightRoles);

  const contrast = await page.evaluate(() => {
    const linearRgb = (value: string) => {
      const channels = value
        .match(/-?[\d.]+/g)!
        .slice(0, 3)
        .map(Number);
      if (value.startsWith("oklch")) {
        const [lightness, chroma, hue] = channels;
        const radians = (hue! * Math.PI) / 180;
        const a = chroma! * Math.cos(radians);
        const b = chroma! * Math.sin(radians);
        const l = (lightness! + 0.3963377774 * a + 0.2158037573 * b) ** 3;
        const m = (lightness! - 0.1055613458 * a - 0.0638541728 * b) ** 3;
        const s = (lightness! - 0.0894841775 * a - 1.291485548 * b) ** 3;
        return [
          4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
        ].map((channel) => Math.max(0, Math.min(1, channel)));
      }
      return channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
    };
    const luminance = (value: string) => {
      const [red, green, blue] = linearRgb(value);
      return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
    };
    const style = getComputedStyle(document.querySelector("main")!);
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (
      (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05)
    );
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);

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

test("forced colors retains textual status and controls", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/preview");

  const truth = page.getByRole("region", { name: "Metric truth states" });
  await expect(truth.getByText("Incompatible").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview receipt" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview receipt" }).focus();
  expect(
    await page
      .getByRole("button", { name: "Preview receipt" })
      .evaluate((node) => {
        const style = getComputedStyle(node);
        return { style: style.outlineStyle, width: style.outlineWidth };
      }),
  ).toEqual({ style: "solid", width: "2px" });
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

test("print retains exact Trace provenance identity", async ({ page }) => {
  await page.emulateMedia({ media: "print" });
  await page.goto("/preview");

  await expect(page.getByText("trace-preview / span-preview")).toBeVisible();
});
