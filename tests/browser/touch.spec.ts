import { test, expect } from "@playwright/test";
import {
  createMatch,
  fleetLengths,
  freshDatabase,
  randomFleet,
  ready,
} from "../../src/engine";
test("touch selects a cell, then confirms exactly one shot", async ({
  page,
}) => {
  const db = freshDatabase();
  const m = createMatch(db, "classic", 0, 0, 17);
  m.sides[0].fleet = randomFleet(fleetLengths("classic"), 77);
  ready(db, "classic", 88);
  m.actor = 0;
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("armada.v1", JSON.stringify(data)),
    db,
  );
  await page.reload();
  await page.locator('[data-do="continue"]').tap();
  await page.locator('.enemy [data-cell="44"]').tap();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("armada.v1")!).slots.classic.sides[0]
          .stats.shots,
    ),
  ).toBe(0);
  await page.locator('[data-do="fire"]').tap();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("armada.v1")!).slots.classic.sides[0]
          .stats.shots,
    ),
  ).toBe(1);
  await expect(page.locator(".board")).toHaveCount(2);
});
