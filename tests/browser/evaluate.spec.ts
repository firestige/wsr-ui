import { expect, test } from "@playwright/test";

const taskPage = {
  contract: { name: "evidence.query", revision: "1.0.0" },
  observation_profile: "2.0.0",
  read_model_revision: "2.0.0",
  snapshot: "browser-task-snapshot",
  items: [
    {
      task_id: "task-browser",
      display_name: "Browser evaluation",
      provenance: {
        accepted_digest: "a".repeat(64),
        profile_version: "2.0.0",
        source: { kind: "EVENT", event_id: "event-browser" },
      },
    },
  ],
  next_cursor: null,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    if (route.request().url().includes("/v1/evidence/tasks")) {
      await route.fulfill({ json: taskPage });
      return;
    }
    await route.continue();
  });
});

test("evaluate selection is keyboard reachable with theme parity", async ({
  page,
}) => {
  await page.goto("/evaluate");
  await expect(
    page.getByRole("heading", { name: "Choose Tasks" }),
  ).toBeVisible();
  await expect(page.getByText("Browser evaluation")).toBeVisible();

  await page.getByLabel("Theme").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightText = await page.locator("main").innerText();
  await page.getByLabel("Theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.locator("main").innerText()).toBe(lightText);

  await page.getByRole("checkbox", { name: /Browser evaluation/ }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Evaluate selection" }),
  ).toBeEnabled();
});
