import { test } from "node:test";
import assert from "node:assert/strict";
import {
  abilities,
  alive,
  botDecision,
  botView,
  cells,
  createMatch,
  declineContinuation,
  execute,
  fleetLengths,
  freshDatabase,
  placementError,
  randomFleet,
  ready,
  reward,
  scanCells,
  surrender,
} from "../src/engine.ts";
import type { Database, Mode, Ship } from "../src/engine.ts";
function game(mode: Mode = "tactical", scenario = 0) {
  const db = freshDatabase(),
    m = createMatch(db, mode, scenario, 0, 123456);
  m.sides[0].fleet = randomFleet(fleetLengths(mode, scenario), 332211);
  if (mode === "challenge" && scenario === 4)
    m.sides[0].inventory = { pulse: 2, guidance: 2, double_shot: 1, repair: 1 };
  assert.ok(ready(db, mode, 775544));
  m.actor = 0;
  if (mode === "tactical")
    for (const a of abilities) db.profile.inventory[a] = 10;
  return db;
}
function take(db: Database, type: any, targets: number[], actor: 0 | 1 = 0) {
  const mode = Object.keys(db.slots)[0] as Mode;
  const next = execute(db, mode, actor, { type, targets });
  assert.ok(next, `Expected accepted ${type}: ${targets}`);
  return next;
}
function ship(
  id: string,
  length: number,
  nose: number,
  heading: 0 | 1 = 0,
  hits: number[] = [],
): Ship {
  return {
    id,
    length,
    nose: nose + (length - 1) * (heading ? 10 : 1),
    heading,
    hits,
  };
}
test("1000 seeded complete fleets are valid, non-touching and contain 20 sections", () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const fleet = randomFleet(fleetLengths("classic"), seed);
    assert.equal(fleet.length, 10);
    assert.equal(fleet.flatMap(cells).length, 20);
    for (const s of fleet) assert.equal(placementError(fleet, s), "");
  }
});
test("placement rejects overlap, diagonals and out-of-bounds; own move ignores original", () => {
  const fleet = [ship("a", 2, 0)];
  assert.equal(placementError(fleet, ship("b", 1, 11)), "touching");
  assert.equal(placementError(fleet, ship("b", 1, 0)), "occupied");
  assert.equal(placementError(fleet, ship("b", 2, 9)), "bounds");
  assert.equal(placementError(fleet, ship("a", 2, 1)), "");
});
test("one ability for uninterrupted turn; hit does not reset quota; rejection atomic", () => {
  let db = game();
  const target = db.slots.tactical!.sides[1].fleet.flatMap(cells)[0];
  db = take(db, "pulse", [0]);
  assert.ok(db.slots.tactical!.abilityUsed);
  db = take(db, "shot", [target]);
  assert.equal(db.slots.tactical!.actor, 0);
  const before = JSON.stringify(db);
  assert.equal(
    execute(db, "tactical", 0, { type: "guidance", targets: [] }),
    null,
  );
  assert.equal(JSON.stringify(db), before);
  const miss = Array.from({ length: 100 }, (_, i) => i).find(
    (c) =>
      !db.slots.tactical!.sides[1].fleet.flatMap(cells).includes(c) &&
      db.slots.tactical!.sides[0].knowledge[c] === "unknown",
  )!;
  db = take(db, "shot", [miss]);
  assert.equal(db.slots.tactical!.actor, 1);
  assert.equal(db.slots.tactical!.abilityUsed, false);
});
test("double shot validates both targets beforehand, even if sinking auto-marks second", () => {
  let db = game();
  const m = db.slots.tactical!;
  m.sides[1].fleet = [ship("a", 1, 0), ship("b", 1, 99)];
  db = take(db, "double_shot", [0, 1]);
  assert.equal(db.slots.tactical!.sides[0].stats.shots, 2);
  assert.equal(db.slots.tactical!.sides[0].stats.hits, 1);
  assert.equal(db.slots.tactical!.sides[0].stats.misses, 1);
  assert.equal(db.slots.tactical!.actor, 0);
  assert.equal(
    execute(db, "tactical", 0, { type: "double_shot", targets: [2, 2] }),
    null,
  );
});
test("two misses pass turn; duplicate target rejects without charge loss", () => {
  let db = game();
  db.slots.tactical!.sides[1].fleet = [ship("a", 1, 99)];
  const before = JSON.stringify(db);
  assert.equal(
    execute(db, "tactical", 0, { type: "double_shot", targets: [0, 0] }),
    null,
  );
  assert.equal(JSON.stringify(db), before);
  db = take(db, "double_shot", [0, 1]);
  assert.equal(db.slots.tactical!.actor, 1);
});
test("repair ends turn, removes cross on both boards, allows repeated attack; sunk repair forbidden", () => {
  let db = game();
  const m = db.slots.tactical!;
  m.sides[0].fleet = [ship("a", 2, 0, 0, [0]), ship("b", 1, 99, 0, [99])];
  m.sides[1].knowledge[0] = "hit";
  m.sides[1].knowledge[99] = "sunk";
  assert.equal(
    execute(db, "tactical", 0, { type: "repair", targets: [99] }),
    null,
  );
  db = take(db, "repair", [0]);
  assert.equal(db.slots.tactical!.actor, 1);
  assert.equal(db.slots.tactical!.sides[1].knowledge[0], "revealed");
  assert.deepEqual(db.slots.tactical!.sides[0].fleet[0].hits, []);
  db = take(db, "shot", [0], 1);
  assert.deepEqual(db.slots.tactical!.sides[0].fleet[0].hits, [0]);
});
test("pulse full 3x3 clamping, intact count, immutable scan snapshots", () => {
  let db = game();
  const m = db.slots.tactical!;
  m.sides[1].fleet = [ship("a", 2, 0, 0, [0]), ship("b", 1, 99)];
  assert.deepEqual(scanCells(0), [0, 1, 2, 10, 11, 12, 20, 21, 22]);
  assert.deepEqual(scanCells(99), [77, 78, 79, 87, 88, 89, 97, 98, 99]);
  db = take(db, "pulse", [0]);
  assert.equal(db.slots.tactical!.sides[0].scans[0].count, 1);
  db = take(db, "shot", [1]);
  assert.equal(db.slots.tactical!.sides[0].scans[0].count, 1);
});
test("guidance reveals without damage and cannot repeat known intact section", () => {
  let db = game();
  db.slots.tactical!.sides[1].fleet = [ship("a", 1, 0)];
  db = take(db, "guidance", []);
  assert.equal(db.slots.tactical!.sides[0].knowledge[0], "revealed");
  assert.deepEqual(db.slots.tactical!.sides[1].fleet[0].hits, []);
  assert.equal(db.slots.tactical!.actor, 1);
  db.slots.tactical!.actor = 0;
  db.slots.tactical!.abilityUsed = false;
  assert.equal(
    execute(db, "tactical", 0, { type: "guidance", targets: [] }),
    null,
  );
});
test("bot boundary invariant under hidden human fleet and human scan changes", () => {
  const db = game(),
    m = db.slots.tactical!;
  m.bot.difficulty = "expert";
  const view = botView(m),
    decision = botDecision(view);
  m.sides[0].fleet = randomFleet(fleetLengths("classic"), 987);
  m.sides[0].scans.push({ cells: [0], count: 999, action: 0 });
  assert.deepEqual(botView(m), view);
  assert.deepEqual(botDecision(botView(m)), decision);
  assert.equal("enemy" in view, false);
});
test("initial charge only on actual first Ready, never setup/load/repeated Ready", () => {
  const db = freshDatabase();
  createMatch(db, "tactical", 0, 0, 123);
  assert.equal(
    Object.values(db.profile.inventory).reduce((a, b) => a + b),
    0,
  );
  db.slots.tactical!.sides[0].fleet = randomFleet(fleetLengths("classic"), 1);
  assert.ok(ready(db, "tactical", 2));
  assert.equal(
    Object.values(db.profile.inventory).reduce((a, b) => a + b),
    1,
  );
  assert.equal(ready(db, "tactical"), false);
  assert.equal(
    Object.values(JSON.parse(JSON.stringify(db)).profile.inventory).reduce(
      (a: any, b: any) => a + b,
    ),
    1,
  );
});
test("surrender and replacement deny next grant, natural end restores eligibility only", () => {
  let db = game();
  const inv = { ...db.profile.inventory };
  surrender(db, "tactical");
  assert.equal(db.profile.freeStartEligible, false);
  const m = createMatch(db, "tactical", 0, 0, 7);
  m.sides[0].fleet = randomFleet(fleetLengths("classic"), 8);
  ready(db, "tactical", 9);
  assert.deepEqual(db.profile.inventory, inv);
  m.actor = 0;
  m.sides[1].fleet = [ship("last", 1, 0)];
  db = take(db, "shot", [0]);
  assert.equal(db.profile.freeStartEligible, true);
  assert.deepEqual(db.profile.inventory, inv);
});
test("reward callback idempotency survives reload; inventory outside match snapshot", () => {
  const db = game();
  const count = db.profile.inventory.pulse;
  assert.ok(reward(db, "tactical", "pulse", "reward-123"));
  assert.equal(db.profile.inventory.pulse, count + 2);
  const restored = JSON.parse(JSON.stringify(db));
  assert.equal(reward(restored, "tactical", "pulse", "reward-123"), false);
  assert.equal(restored.profile.inventory.pulse, count + 2);
});
test("three fixed mode snapshots are isolated", () => {
  const db = game("classic");
  const before = JSON.stringify(db.slots.classic);
  createMatch(db, "tactical");
  createMatch(db, "challenge");
  assert.equal(JSON.stringify(db.slots.classic), before);
  assert.deepEqual(Object.keys(db.slots).sort(), [
    "challenge",
    "classic",
    "tactical",
  ]);
});
for (const scenario of [1, 2, 3])
  test(`challenge ${scenario}: last-resource victory precedes exhaustion`, () => {
    let db = game("challenge", scenario);
    const m = db.slots.challenge!;
    m.sides[1].fleet = [
      ship(
        "last",
        scenario === 1 ? 4 : 1,
        0,
        0,
        scenario === 1 ? [0, 1, 2] : [],
      ),
    ];
    m.actions = m.limit - 1;
    m.ammo = m.limit - 1;
    m.sides[0].stats.misses = m.limit - 1;
    db = take(db, "shot", [scenario === 1 ? 3 : 0]);
    assert.equal(db.slots.challenge!.stage, "finished");
    assert.equal(db.slots.challenge!.winner, 0);
    assert.equal(db.profile.results[Object.keys(db.profile.results)[0]], 2);
  });
test("challenge costs, exhaustion and single continuation isolated from global inventory", () => {
  let db = game("challenge", 2);
  const global = { ...db.profile.inventory },
    m = db.slots.challenge!;
  m.sides[1].fleet = [ship("last", 1, 99)];
  m.ammo = 43;
  db = take(db, "double_shot", [0, 1]);
  assert.equal(db.slots.challenge!.ammo, 45);
  assert.equal(db.slots.challenge!.actions, 1);
  assert.equal(db.slots.challenge!.sides[0].stats.misses, 2);
  assert.equal(db.slots.challenge!.stage, "continuation");
  assert.ok(reward(db, "challenge", "repair", "cont"));
  assert.equal(db.slots.challenge!.limit, 55);
  assert.equal(reward(db, "challenge", "pulse", "cont2"), false);
  assert.deepEqual(db.profile.inventory, global);
});
test("declining continuation ends attempt; selection needs six/max three", () => {
  const db = game("challenge", 4);
  createMatch(db, "challenge", 4);
  db.slots.challenge!.sides[0].fleet = randomFleet(fleetLengths("classic"), 9);
  db.slots.challenge!.sides[0].inventory = {
    pulse: 3,
    guidance: 2,
    double_shot: 0,
    repair: 0,
  };
  assert.equal(ready(db, "challenge"), false);
  db.slots.challenge!.sides[0].inventory = {
    pulse: 4,
    guidance: 2,
    double_shot: 0,
    repair: 0,
  };
  assert.equal(ready(db, "challenge"), false);
  db.slots.challenge!.sides[0].inventory = {
    pulse: 3,
    guidance: 3,
    double_shot: 0,
    repair: 0,
  };
  assert.ok(ready(db, "challenge"));
  db.slots.challenge!.stage = "continuation";
  declineContinuation(db, "challenge");
  assert.equal(db.slots.challenge!.stage, "finished");
});
test("all modes can complete entire games with honest bot decisions", () => {
  for (const mode of ["classic", "tactical", "challenge"] as Mode[])
    for (
      let scenario = 0;
      scenario < (mode === "challenge" ? 5 : 1);
      scenario++
    ) {
      let db = game(mode, scenario),
        steps = 0;
      while (db.slots[mode]!.stage === "active" && steps++ < 500) {
        const m = db.slots[mode]!;
        let command;
        if (m.actor === 1) {
          const d = botDecision(botView(m));
          command = d.command;
        } else
          command = {
            type: "shot" as const,
            targets: [
              m.sides[0].knowledge.findIndex(
                (mark) => mark === "unknown" || mark === "revealed",
              ),
            ],
          };
        const next = execute(db, mode, m.actor, command);
        if (!next && command.type === "guidance") {
          db = take(
            db,
            "shot",
            [
              m.sides[1].knowledge.findIndex(
                (mark) => mark === "unknown" || mark === "revealed",
              ),
            ],
            1,
          );
        } else {
          assert.ok(next);
          db = next;
        }
      }
      assert.ok(steps < 500);
      assert.ok(["finished", "continuation"].includes(db.slots[mode]!.stage));
    }
});

test("natural tactical defeat restores eligibility without granting a reward", () => {
  let db = game();
  const inv = { ...db.profile.inventory },
    m = db.slots.tactical!;
  m.sides[0].fleet = [ship("last", 1, 0)];
  m.actor = 1;
  db = take(db, "shot", [0], 1);
  assert.equal(db.slots.tactical!.winner, 1);
  assert.equal(db.profile.freeStartEligible, true);
  assert.deepEqual(db.profile.inventory, inv);
});
test("mastery cannot be downgraded by a replay with refill", () => {
  let db = game("challenge", 0);
  db.profile.results.last_stand = 2;
  const m = db.slots.challenge!;
  m.sides[1].fleet = [ship("last", 1, 0)];
  m.refilled = true;
  db = take(db, "shot", [0]);
  assert.equal(db.profile.results.last_stand, 2);
});
test("last ammunition prohibits double shot but accepts a single shot; pulse costs no limited resources", () => {
  let db = game("challenge", 2);
  const m = db.slots.challenge!;
  m.ammo = 44;
  assert.equal(
    execute(db, "challenge", 0, { type: "double_shot", targets: [0, 1] }),
    null,
  );
  db = take(db, "pulse", [0]);
  assert.equal(db.slots.challenge!.ammo, 44);
  assert.equal(db.slots.challenge!.actions, 0);
});
test("guidance and repair cost flagship actions, no ammunition; pulse costs none", () => {
  let db = game("challenge", 1);
  db.slots.challenge!.sides[0].inventory.repair = 1;
  db.slots.challenge!.sides[0].fleet[0].hits = [
    cells(db.slots.challenge!.sides[0].fleet[0])[0],
  ];
  const repaired = db.slots.challenge!.sides[0].fleet[0].hits[0];
  db = take(db, "repair", [repaired]);
  assert.equal(db.slots.challenge!.actions, 1);
  assert.equal(db.slots.challenge!.ammo, 0);
  db.slots.challenge!.actor = 0;
  db.slots.challenge!.abilityUsed = false;
  db = take(db, "guidance", []);
  assert.equal(db.slots.challenge!.actions, 2);
  assert.equal(db.slots.challenge!.ammo, 0);
});
test("repair impossible after fleet destruction: no continuation can revive defeat", () => {
  let db = game("challenge", 0);
  const m = db.slots.challenge!;
  m.sides[0].fleet = [ship("last", 1, 0)];
  m.actor = 1;
  db = take(db, "shot", [0], 1);
  assert.equal(db.slots.challenge!.stage, "finished");
  assert.equal(reward(db, "challenge", "repair", "revive"), false);
});
test("nose anchor matches east/down headings and rotation preserves nose", () => {
  const s: Ship = { id: "nose", length: 3, nose: 44, heading: 0, hits: [] };
  assert.deepEqual(cells(s), [44, 43, 42]);
  s.heading = 1;
  assert.deepEqual(cells(s), [44, 34, 24]);
});
