import {
  botDecision,
  botView,
  createMatch,
  execute,
  fleetLengths,
  freshDatabase,
  randomFleet,
  ready,
} from "../src/engine.ts";
import type { Bot } from "../src/engine.ts";
const report = [];
for (const difficulty of [
  "easy",
  "medium",
  "hard",
  "expert",
] as Bot["difficulty"][]) {
  const samples = [];
  for (let seed = 1; seed <= 30; seed++) {
    let db = freshDatabase();
    const m = createMatch(db, "classic", 0, 0, seed * 7919);
    m.sides[0].fleet = randomFleet(fleetLengths("classic"), seed * 3571);
    ready(db, "classic", seed * 2377);
    m.bot.difficulty = difficulty;
    m.sides[1].rng = seed * 997;
    let steps = 0;
    while (db.slots.classic!.stage !== "finished" && steps++ < 150) {
      const live = db.slots.classic!;
      live.actor = 1;
      const decision = botDecision(botView(live));
      live.sides[1].rng = decision.rng;
      const next = execute(db, "classic", 1, decision.command);
      if (!next) throw Error("Rejected bot command");
      db = next;
    }
    samples.push(db.slots.classic!.sides[1].stats.shots);
  }
  report.push({
    difficulty,
    runs: samples.length,
    meanShots: +(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(
      2,
    ),
    min: Math.min(...samples),
    max: Math.max(...samples),
  });
}
console.log(
  JSON.stringify(
    {
      description:
        "Solo search of 30 identical static standard fleets per level; no abilities, opponent does not shoot. Lower shots is better. This is a strategy smoke benchmark, not match balance.",
      seedRange: [1, 30],
      results: report,
    },
    null,
    2,
  ),
);
