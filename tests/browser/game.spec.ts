import { test, expect } from "@playwright/test";
test("deployment, cancellation, autosave restoration, language and square board matrix", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('[data-do="modes"]').click();
  await page.locator('[data-do="new:classic"]').click();
  await page.locator('[data-do="random"]').click();
  await expect(page.locator(".own .ship")).toHaveCount(10);
  const saved = await page.evaluate(() => localStorage.getItem("armada.v1"));
  await page.locator('.own [data-cell="0"]').click();
  for (const [w, h] of [
    [360, 800],
    [390, 844],
    [412, 915],
    [768, 1024],
    [844, 390],
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const board of await page.locator(".board").all()) {
      const box = (await board.boundingBox())!;
      expect(Math.abs(box.width - box.height)).toBeLessThan(1.5);
    }
    const geom = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
    }));
    expect(geom.scroll).toBeLessThanOrEqual(geom.width);
    await page.screenshot({
      path: `test-results/${info.project.name}-${w}x${h}.png`,
    });
  }
  await page.reload();
  await page.locator('[data-do="continue"]').click();
  await expect(page.locator(".own .ship")).toHaveCount(10);
  expect(await page.evaluate(() => localStorage.getItem("armada.v1"))).toBe(
    saved,
  );
  await page.locator('[data-do="ready"]').click();
  await expect(page.locator(".fire-control")).toBeVisible();
  await page.locator('[data-do="pause"]').click();
  await expect(page.locator(".pause")).toBeVisible();
  const before = await page.evaluate(() => localStorage.getItem("armada.v1"));
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => localStorage.getItem("armada.v1"))).toBe(
    before,
  );
  await page.locator('[data-do="menu"]').last().click();
  await page.locator('[data-do="language"]').click();
  await expect(page).toHaveTitle("Terra Defense: Armada");
  expect(errors).toEqual([]);
});
test("all five challenges reachable, charge selection, ad unavailable and isolated test rewards", async ({
  page,
}) => {
  await page.goto("/?devAds=1");
  await page.locator('[data-do="modes"]').click();
  await page.locator('[data-do="new:challenge"]').click();
  await expect(page.locator('[data-do^="challenge:"]')).toHaveCount(5);
  await page.locator('[data-do="challenge:4"]').click();
  await expect(page.locator("[data-charge]")).toHaveCount(4);
  await page.locator('[data-charge="pulse"]').fill("3");
  await page.locator('[data-charge="pulse"]').dispatchEvent("change");
  await page.locator('[data-charge="guidance"]').fill("3");
  await page.locator('[data-charge="guidance"]').dispatchEvent("change");
  await page.locator('[data-do="random"]').click();
  await page.locator('[data-do="ready"]').click();
  await expect(page.locator(".fire-control")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("armada.v1")),
  ).toBeNull();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("armada.v1.test")!).slots.challenge
          .started,
    ),
  ).toBe(true);
});
