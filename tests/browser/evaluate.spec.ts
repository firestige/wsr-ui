import { expect, test } from "@playwright/test";

import { evaluationResponse } from "./evolution-fixture";

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
    if (
      route.request().url().includes("/api/evolution/v1/evaluations:compute")
    ) {
      await route.fulfill({
        json: evaluationResponse(route.request().postDataJSON()),
      });
      return;
    }
    await route.continue();
  });
});

test("single deep link restores authoritative truth, coverage, and receipt", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/evolution/v1/evaluations:compute"))
      requests += 1;
  });
  await page.goto("/evaluate?v=1&task=task-browser");

  await expect(page.getByText("0.00%").first()).toBeVisible();
  await expect(page.getByText("Low coverage")).toBeVisible();
  await expect(
    page.locator(".status-label", { hasText: "Lower bound" }),
  ).toBeVisible();
  await expect(page.getByText("Unavailable")).toBeVisible();
  await expect(
    page.locator(".status-label", { hasText: "Expired" }),
  ).toBeVisible();
  await expect(page.getByText("INCOMPATIBLE", { exact: true })).toBeVisible();
  await expect(page.getByText("NOT_APPLICABLE", { exact: true })).toBeVisible();

  const receipt = page.getByRole("button", { name: "View receipt" });
  await receipt.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Evaluation receipt" }),
  ).toContainText("task-browser");
  await page.keyboard.press("Escape");
  await expect(receipt).toBeFocused();

  await page.reload();
  await expect(page).toHaveURL("/evaluate?v=1&task=task-browser");
  await expect(page.getByText("0.00%").first()).toBeVisible();
  expect(requests).toBe(2);
});

test("compare keeps Before and After primary on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/evaluate?v=1&mode=compare&left_task=task-before&right_task=task-after",
  );

  const comparison = page
    .getByRole("article", {
      name: "Compare role-template-rework-rate@2.0.0",
    })
    .first();
  await expect(comparison).toBeVisible();
  expect(
    await comparison
      .locator(":scope > section")
      .evaluateAll((sections) =>
        sections.map((section) => section.getAttribute("aria-label")),
      ),
  ).toEqual(["Before result", "After result", "Delta result"]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("API failure remains scoped, retryable, and preserves the deep link", async ({
  page,
}) => {
  await page.route("**/api/evolution/v1/evaluations:compute", async (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          detail: "Evidence timed out",
          retryable: true,
        },
      }),
    }),
  );
  await page.goto("/evaluate?v=1&task=task-browser");

  await expect(page.getByRole("alert")).toContainText("Evidence timed out");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page).toHaveURL("/evaluate?v=1&task=task-browser");
});

test("Evidence drill-down preserves exact selection, scope, and return identity", async ({
  page,
}) => {
  await page.goto("/evaluate?v=1&task=task-browser");
  await page.getByRole("button", { name: "View evidence" }).first().focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Evidence Console" }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    "/evaluate/evidence?v=1&task=task-browser&metric=role-template-rework-rate%402.0.0&side=single&scope=result",
  );
  await page.getByRole("button", { name: "Related Facts" }).click();
  await expect(page).toHaveURL(/scope=related/);
  await page.getByRole("button", { name: "Back to evaluation" }).click();
  await expect(page).toHaveURL(
    "/evaluate?v=1&task=task-browser&metric=role-template-rework-rate%402.0.0&side=single",
  );
  await expect(
    page
      .getByRole("article", { name: "role-template-rework-rate@2.0.0" })
      .first(),
  ).toBeVisible();
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
