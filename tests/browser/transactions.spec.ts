import { test, expect } from "@playwright/test";
import {
  createMatch,
  fleetLengths,
  freshDatabase,
  randomFleet,
  ready,
} from "../../src/engine";
import type { Mode } from "../../src/engine";

function fixture(mode: Mode = "tactical", scenario = 0) {
  const db = freshDatabase();
  const m = createMatch(db, mode, scenario, 0, 42);
  m.sides[0].fleet = randomFleet(fleetLengths(mode, scenario), 123);
  if (mode === "challenge" && scenario === 4)
    m.sides[0].inventory = { pulse: 3, guidance: 3, double_shot: 0, repair: 0 };
  ready(db, mode, 987);
  m.actor = 0;
  db.profile.inventory = { pulse: 5, guidance: 5, double_shot: 5, repair: 5 };
  return db;
}

test("shot selection requires confirmation and setup edit cancellation preserves original", async ({
  page,
}) => {
  const db = fixture("classic");
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("armada.v1", JSON.stringify(data)),
    db,
  );
  await page.reload();
  await page.locator('[data-do="continue"]').click();
  await page.locator('.enemy [data-cell="44"]').click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("armada.v1")!).slots.classic.action,
    ),
  ).toBe(0);
  await expect(page.locator('[data-do="fire"]')).toBeEnabled();
  await page.locator('[data-do="fire"]').click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("armada.v1")!).slots.classic.sides[0]
          .stats.shots,
    ),
  ).toBe(1);
});

test("dev ad success/cancel/error/unavailable is isolated and does not duplicate on reload", async ({
  page,
}) => {
  const db = fixture();
  await page.goto("/?devAds=1");
  await page.evaluate(
    (data) => localStorage.setItem("armada.v1.test", JSON.stringify(data)),
    db,
  );
  await page.reload();
  await page.locator('[data-do="continue"]').click();
  for (const status of ["cancel", "error", "unavailable", "success"]) {
    let i = 0;
    const listener = async (dialog: any) => {
      await dialog.accept(i++ === 0 ? "1" : status);
    };
    page.on("dialog", listener);
    await page.locator('[data-do="refill"]').click();
    await expect(page.locator('[role="status"]')).toContainText(
      status === "success"
        ? "Награда"
        : status === "cancel"
          ? "отменён"
          : status === "error"
            ? "Ошибка"
            : "недоступна",
    );
    page.off("dialog", listener);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("armada.v1.test")!),
    );
    expect(stored.profile.inventory.pulse).toBe(status === "success" ? 7 : 5);
    expect(stored.profile.operations.length).toBe(status === "success" ? 2 : 1);
  }
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("armada.v1.test")!).profile.inventory
          .pulse,
    ),
  ).toBe(7);
  expect(
    await page.evaluate(() => localStorage.getItem("armada.v1")),
  ).toBeNull();
});

test("real adapter mock: reward-only callback, duplicate protection, SDK pause preserves user pause", async ({
  page,
}) => {
  await page.route("**/sdk.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.sdkEvents={}; window.sdkCounters={ready:0,start:0,stop:0}; window.YaGames={init:async()=>({on:(name,cb)=>window.sdkEvents[name]=cb,features:{LoadingAPI:{ready:()=>window.sdkCounters.ready++},GameplayAPI:{start:()=>window.sdkCounters.start++,stop:()=>window.sdkCounters.stop++}},adv:{showRewardedVideo:({callbacks})=>{callbacks.onOpen();window.sdkEvents.game_api_pause();callbacks.onRewarded();callbacks.onRewarded();callbacks.onClose();window.sdkEvents.game_api_resume();}}})};`,
    }),
  );
  const db = fixture();
  await page.goto("/?platform=yandex");
  await page.evaluate(
    (data) => localStorage.setItem("armada.v1", JSON.stringify(data)),
    db,
  );
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => (window as any).sdkCounters.ready))
    .toBe(1);
  await page.locator('[data-do="continue"]').click();
  page.once("dialog", (d) => d.accept("1"));
  await page.locator('[data-do="refill"]').click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("armada.v1")!).profile.inventory.pulse,
    ),
  ).toBe(7);
  await page.locator('[data-do="pause"]').click();
  page.once("dialog", (d) => d.accept("1"));
  await page.locator('.pause [data-do="refill"]').click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("armada.v1")!).profile.inventory.pulse,
    ),
  ).toBe(9);
  await page.evaluate(() => {
    (window as any).sdkEvents.game_api_pause();
    (window as any).sdkEvents.game_api_resume();
  });
  await expect(page.locator(".pause")).toBeVisible();
  await expect(page.locator('[data-do="fire"]')).toBeDisabled();
});

test("eight sprites have real transparency, load locally, and fit both orientations", async ({
  page,
}) => {
  await page.goto("/");
  const ids = [
    "hero_prototype",
    "hero_twin",
    "hero_bastion",
    "hero_monolith",
    "enemy_standard",
    "enemy_scorpion",
    "enemy_cascade",
    "enemy_hammer",
  ];
  const results = await page.evaluate(
    async (ids) =>
      Promise.all(
        ids.map(async (id) => {
          const image = new Image();
          image.src = `/assets/sprites/${id}.png`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(image, 0, 0);
          const d = ctx.getImageData(0, 0, image.width, image.height).data;
          let clear = 0,
            solid = 0;
          for (let i = 3; i < d.length; i += 4) {
            if (d[i] === 0) clear++;
            if (d[i] === 255) solid++;
          }
          return { id, width: image.width, height: image.height, clear, solid };
        }),
      ),
    ids,
  );
  for (const r of results) {
    expect(r.clear).toBeGreaterThan(100);
    expect(r.solid).toBeGreaterThan(100);
  }
  await page.evaluate(
    (data) => localStorage.setItem("armada.v1", JSON.stringify(data)),
    fixture(),
  );
  await page.reload();
  await page.locator('[data-do="continue"]').click();
  await expect(page.locator(".own .ship img")).toHaveCount(10);
  expect(await page.locator(".enemy .ship img").count()).toBe(0);
});

test("both active boards fit portrait and landscape viewports; no horizontal overflow", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("armada.v1", JSON.stringify(data)),
    fixture(),
  );
  await page.reload();
  await page.locator('[data-do="continue"]').click();
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [412, 915],
    [768, 1024],
    [844, 390],
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    const own = (await page.locator(".own .board").boundingBox())!,
      enemy = (await page.locator(".enemy .board").boundingBox())!;
    expect(own.y + own.height).toBeLessThan(height + 1);
    expect(enemy.y + enemy.height).toBeLessThan(height + 1);
    if (height > width) {
      expect(enemy.y).toBeLessThan(own.y);
    } else {
      expect(own.x).toBeLessThan(enemy.x);
    }
    expect(Math.abs(own.width - own.height)).toBeLessThan(1.5);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const controls = (await page.locator(".fire-control").boundingBox())!;
    expect(controls.y + controls.height).toBeLessThanOrEqual(height + 1);
    await page.screenshot({
      path: `test-results/${info.project.name}-active-${width}x${height}.png`,
    });
  }
});

test("moving and rotating preview can be cancelled without changing saved setup", async ({
  page,
}) => {
  const db = fixture("classic");
  const m = db.slots.classic!;
  m.stage = "setup";
  m.started = false;
  m.sides[1].fleet = [];
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("armada.v1", JSON.stringify(data)),
    db,
  );
  await page.reload();
  await page.locator('[data-do="continue"]').click();
  const before = await page.evaluate(() => localStorage.getItem("armada.v1"));
  await page.locator(`.own [data-cell="${m.sides[0].fleet[0].nose}"]`).click();
  await page.locator('[data-do="rotate"]').click();
  await page.locator('.own [data-cell="44"]').click();
  await page.locator('[data-do="cancel"]').click();
  expect(await page.evaluate(() => localStorage.getItem("armada.v1"))).toBe(
    before,
  );
});

test("stale tab cannot overwrite newer inventory or save slot", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("armada.v1", JSON.stringify(data)),
    fixture(),
  );
  await page.reload();
  const other = await context.newPage();
  await other.goto("/");
  await other.locator('[data-do="language"]').click();
  const fresh = await other.evaluate(() => localStorage.getItem("armada.v1"));
  await page.locator('[data-do="language"]').click();
  await expect(page.locator('[role="status"]')).toContainText(
    "Не удалось сохранить",
  );
  expect(await page.evaluate(() => localStorage.getItem("armada.v1"))).toBe(
    fresh,
  );
});
