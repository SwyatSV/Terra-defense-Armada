import { test, expect } from "@playwright/test";
test("incomplete saved profile does not leave a blank page or overwrite data", async ({
  page,
}) => {
  await page.goto("/");
  const raw = JSON.stringify({ version: 1, profile: {}, slots: {} });
  await page.evaluate((value) => localStorage.setItem("armada.v1", value), raw);
  await page.reload();
  await expect(page.locator('[data-do="modes"]')).toBeVisible();
  await expect(page.locator('[role="status"]')).toContainText(
    "Сохранение не прочитано",
  );
  expect(await page.evaluate(() => localStorage.getItem("armada.v1"))).toBe(
    raw,
  );
  await expect(page.locator("#startup-error")).toHaveCount(0);
});
test("module load error is visible rather than an empty tab", async ({
  page,
}) => {
  await page.route(/\/src\/main\.ts(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "throw new Error('startup-test-failure')",
    }),
  );
  await page.goto("/");
  await expect(page.locator("#startup-error")).toBeVisible();
  await expect(page.locator("#startup-error")).toContainText(
    "Не удалось открыть игру",
  );
});
