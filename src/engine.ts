import { rules, balance, challenges, names } from "./data.ts";
export type Ability = "pulse" | "guidance" | "double_shot" | "repair";
export type Mode = "classic" | "tactical" | "challenge";
export type Inventory = Record<Ability, number>;
export type Ship = {
  id: string;
  length: number;
  nose: number;
  heading: 0 | 1;
  hits: number[];
};
export type Mark = "unknown" | "miss" | "hit" | "sunk" | "empty" | "revealed";
export type Scan = { cells: number[]; count: number; action: number };
export type Side = {
  fleet: Ship[];
  knowledge: Mark[];
  scans: Scan[];
  inventory: Inventory;
  stats: { shots: number; hits: number; misses: number; abilities: Inventory };
  rng: number;
};
export type Bot = {
  nickname: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  personality: keyof typeof balance.bot_starting_charges.value;
};
export type Match = {
  id: string;
  mode: Mode;
  scenario: number;
  faction: 0 | 1;
  stage: "setup" | "active" | "continuation" | "finished";
  sides: [Side, Side];
  actor: 0 | 1;
  abilityUsed: boolean;
  bot: Bot;
  action: number;
  actions: number;
  ammo: number;
  limit: number;
  refilled: boolean;
  winner: 0 | 1 | null;
  reason: string;
  events: { actor: number; kind: string; cells?: number[]; action: number }[];
  lastShot: number[];
  updated: number;
  started: boolean;
};
export type Profile = {
  inventory: Inventory;
  freeStartEligible: boolean;
  operations: string[];
  recent: string[];
  results: Record<string, number>;
  history: { id: string; mode: Mode; winner: number | null; reason: string }[];
  settings: {
    lang: "ru" | "en";
    music: number;
    effects: number;
    reduced: boolean;
  };
};
export type Database = {
  version: 1;
  profile: Profile;
  slots: Partial<Record<Mode, Match>>;
};
export type Command = { type: "shot" | Ability; targets: number[] };
export const abilities: Ability[] = [
  "pulse",
  "guidance",
  "double_shot",
  "repair",
];
export const emptyInventory = (): Inventory => ({
  pulse: 0,
  guidance: 0,
  double_shot: 0,
  repair: 0,
});
export const freshDatabase = (): Database => ({
  version: 1,
  profile: {
    inventory: emptyInventory(),
    freeStartEligible: true,
    operations: [],
    recent: [],
    results: {},
    history: [],
    settings: { lang: "ru", music: 0.25, effects: 0.5, reduced: false },
  },
  slots: {},
});
export function random(state: { rng: number }) {
  let x = state.rng | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rng = x >>> 0 || 1;
  return state.rng / 4294967296;
}
export const cells = (s: Ship) =>
  Array.from({ length: s.length }, (_, i) => s.nose - i * (s.heading ? 10 : 1));
export const sunk = (s: Ship) => s.hits.length === s.length;
export const alive = (s: Side) => s.fleet.filter((x) => !sunk(x)).length;
export const near = (a: number, b: number) =>
  Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) <= 1 &&
  Math.abs((a % 10) - (b % 10)) <= 1;
export function placementError(fleet: Ship[], ship: Ship): string {
  const cs = cells(ship);
  if (
    !Number.isInteger(ship.nose) ||
    ship.nose < 0 ||
    cs.some((c) => c < 0 || c > 99) ||
    (!ship.heading && (ship.nose % 10) - ship.length + 1 < 0)
  )
    return "bounds";
  const rest = fleet.filter((s) => s.id !== ship.id).flatMap(cells);
  if (cs.some((c) => rest.includes(c))) return "occupied";
  if (cs.some((c) => rest.some((b) => near(c, b)))) return "touching";
  return "";
}
export function fleetLengths(mode: Mode, scenario = 0) {
  return (
    mode === "challenge"
      ? challenges.scenarios[scenario].player_fleet
      : rules.standard_fleet
  )
    .flatMap((x) => Array(x.count).fill(x.length) as number[])
    .sort((a, b) => b - a);
}
export function randomFleet(lengths: number[], seed: number): Ship[] {
  const rng = { rng: seed || 1 };
  for (let restart = 0; restart < 1000; restart++) {
    const fleet: Ship[] = [];
    for (const length of lengths) {
      let found = false;
      for (let i = 0; i < 500; i++) {
        const ship: Ship = {
          id: `s${fleet.length}`,
          length,
          nose: Math.floor(random(rng) * 100),
          heading: random(rng) < 0.5 ? 0 : 1,
          hits: [],
        };
        if (!placementError(fleet, ship)) {
          fleet.push(ship);
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    if (fleet.length === lengths.length) return fleet;
  }
  throw Error("Fleet generation failed");
}
function side(seed: number): Side {
  return {
    fleet: [],
    knowledge: Array(100).fill("unknown"),
    scans: [],
    inventory: emptyInventory(),
    stats: { shots: 0, hits: 0, misses: 0, abilities: emptyInventory() },
    rng: seed || 1,
  };
}
export function createMatch(
  db: Database,
  mode: Mode,
  scenario = 0,
  faction: 0 | 1 = 0,
  seed = Date.now() >>> 0,
  previousBot?: Bot,
): Match {
  const rng = { rng: seed || 1 };
  const pick = <T>(items: T[]) => items[Math.floor(random(rng) * items.length)];
  const difficultyRoll = random(rng) * 100;
  const difficulty: Bot["difficulty"] =
    difficultyRoll < 30
      ? "easy"
      : difficultyRoll < 70
        ? "medium"
        : difficultyRoll < 95
          ? "hard"
          : "expert";
  const personality = pick(
    Object.keys(balance.bot_starting_charges.value) as Bot["personality"][],
  );
  const bot = previousBot
    ? structuredClone(previousBot)
    : {
        nickname: pick(
          names.nicknames.filter((n) => !db.profile.recent.includes(n)),
        ),
        difficulty,
        personality,
      };
  if (mode === "challenge") {
    bot.difficulty = challenges.scenarios[scenario].bot_profile
      .difficulty as Bot["difficulty"];
    bot.personality = challenges.scenarios[scenario].bot_profile
      .personality as Bot["personality"];
  }
  if (!previousBot)
    db.profile.recent = [...db.profile.recent, bot.nickname].slice(
      -names.selection.avoid_recent_names,
    );
  const m: Match = {
    id: globalThis.crypto.randomUUID(),
    mode,
    scenario,
    faction,
    stage: "setup",
    sides: [
      side((random(rng) * 4294967296) >>> 0),
      side((random(rng) * 4294967296) >>> 0),
    ],
    actor: 0,
    abilityUsed: false,
    bot,
    action: 0,
    actions: 0,
    ammo: 0,
    limit:
      mode === "challenge"
        ? (challenges.scenarios[scenario].limit?.initial ?? 0)
        : 0,
    refilled: false,
    winner: null,
    reason: "",
    events: [],
    lastShot: [],
    updated: Date.now(),
    started: false,
  };
  if (mode === "challenge")
    m.sides[0].inventory = {
      ...emptyInventory(),
      ...challenges.scenarios[scenario].starting_charges.value,
    };
  if (mode !== "classic")
    m.sides[1].inventory = {
      ...balance.bot_starting_charges.value[bot.personality],
    };
  db.slots[mode] = m;
  return m;
}
export function ready(
  db: Database,
  mode: Mode,
  placementSeed = Date.now() >>> 0,
): boolean {
  const m = db.slots[mode];
  if (!m || m.stage !== "setup") return false;
  const expected = fleetLengths(mode, m.scenario);
  const fleet = m.sides[0].fleet;
  if (
    fleet
      .map((x) => x.length)
      .sort((a, b) => b - a)
      .join() !== expected.join() ||
    new Set(fleet.map((x) => x.id)).size !== fleet.length ||
    fleet.some((x) => placementError(fleet, x))
  )
    return false;
  if (
    mode === "challenge" &&
    challenges.scenarios[m.scenario].starting_charges.selection
  ) {
    const inv = m.sides[0].inventory;
    if (
      abilities.reduce((sum, a) => sum + inv[a], 0) !== 6 ||
      abilities.some((a) => inv[a] > 3 || inv[a] < 0)
    )
      return false;
  }
  m.sides[1].fleet = randomFleet(fleetLengths("classic"), placementSeed);
  if (mode === "tactical" && db.profile.freeStartEligible) {
    const a = abilities[Math.floor(random(m.sides[0]) * 4)];
    db.profile.inventory[a]++;
    db.profile.freeStartEligible = false;
    db.profile.operations.push(`start:${m.id}`);
  }
  m.started = true;
  m.stage = "active";
  m.actor = random(m.sides[1]) < 0.5 ? 0 : 1;
  m.updated = Date.now();
  return true;
}
export const legal = (mark: Mark) => mark === "unknown" || mark === "revealed";
export function scanCells(anchor: number) {
  const r = Math.max(0, Math.min(7, Math.floor(anchor / 10) - 1));
  const c = Math.max(0, Math.min(7, (anchor % 10) - 1));
  return Array.from(
    { length: 9 },
    (_, i) => (r + Math.floor(i / 3)) * 10 + c + (i % 3),
  );
}
export function inventory(db: Database, m: Match, actor: 0 | 1) {
  return actor === 0 && m.mode === "tactical"
    ? db.profile.inventory
    : m.sides[actor].inventory;
}
export function canUseAbility(
  db: Database,
  m: Match,
  actor: 0 | 1,
  a: Ability,
): boolean {
  if (
    m.mode === "classic" ||
    m.stage !== "active" ||
    m.actor !== actor ||
    m.abilityUsed ||
    inventory(db, m, actor)[a] <= 0
  )
    return false;
  const own = m.sides[actor];
  if (a === "repair")
    return own.fleet.some((s) => !sunk(s) && s.hits.length > 0);
  if (a === "guidance")
    return (
      fleetLengths(actor === 0 ? "classic" : m.mode, m.scenario).reduce(
        (sum, l) => sum + l,
        0,
      ) >
      own.knowledge.filter(
        (mark) => mark === "hit" || mark === "sunk" || mark === "revealed",
      ).length
    );
  if (a === "double_shot")
    return (
      own.knowledge.filter(legal).length >= 2 &&
      !(
        actor === 0 &&
        m.mode === "challenge" &&
        challenges.scenarios[m.scenario].limit?.kind === "player_ammunition" &&
        m.limit - m.ammo < 2
      )
    );
  return true;
}
function finish(
  db: Database,
  m: Match,
  winner: 0 | 1,
  reason: string,
  natural = true,
) {
  m.stage = "finished";
  m.winner = winner;
  m.reason = reason;
  if (m.mode === "tactical" && natural) db.profile.freeStartEligible = true;
  if (m.mode === "challenge" && winner === 0) {
    const id = challenges.scenarios[m.scenario].id;
    db.profile.results[id] = Math.max(
      db.profile.results[id] ?? 0,
      m.refilled ? 1 : 2,
    );
  }
  if (!db.profile.history.some((r) => r.id === m.id))
    db.profile.history.push({ id: m.id, mode: m.mode, winner, reason });
}
export function surrender(db: Database, mode: Mode) {
  const m = db.slots[mode];
  if (m && m.started && m.stage !== "finished")
    finish(db, m, 1, "surrender", false);
}
function shot(m: Match, actor: 0 | 1, target: number) {
  const own = m.sides[actor],
    enemy = m.sides[1 - actor];
  const ship = enemy.fleet.find((s) => cells(s).includes(target));
  own.stats.shots++;
  let hit = false;
  if (ship && !ship.hits.includes(target)) {
    hit = true;
    ship.hits.push(target);
    own.stats.hits++;
    own.knowledge[target] = "hit";
    if (sunk(ship)) {
      for (const c of cells(ship)) own.knowledge[c] = "sunk";
      for (let c = 0; c < 100; c++)
        if (
          own.knowledge[c] === "unknown" &&
          cells(ship).some((b) => near(c, b))
        )
          own.knowledge[c] = "empty";
    }
  } else {
    own.stats.misses++;
    own.knowledge[target] = "miss";
  }
  m.events.push({
    actor,
    kind: ship ? (sunk(ship) ? "sunk" : "hit") : "miss",
    cells: [target],
    action: m.action,
  });
  return hit;
}
// Validate and resolve on a clone: rejection never changes resources, RNG, or turn.
export function execute(
  db: Database,
  mode: Mode,
  actor: 0 | 1,
  cmd: Command,
): Database | null {
  const next = structuredClone(db);
  const m = next.slots[mode];
  if (!m || m.stage !== "active" || m.actor !== actor) return null;
  const own = m.sides[actor],
    enemy = m.sides[1 - actor],
    inv = inventory(next, m, actor),
    isAbility = cmd.type !== "shot";
  if (
    isAbility &&
    (mode === "classic" || m.abilityUsed || inv[cmd.type as Ability] <= 0)
  )
    return null;
  if (cmd.targets.some((c) => !Number.isInteger(c) || c < 0 || c > 99))
    return null;
  const type = cmd.type;
  let retains = false;
  const cost = type === "pulse" ? 0 : 1;
  const ammo = type === "shot" ? 1 : type === "double_shot" ? 2 : 0;
  const scenario = challenges.scenarios[m.scenario];
  if (actor === 0 && mode === "challenge" && scenario.limit) {
    if (scenario.limit.kind === "player_actions" && m.actions + cost > m.limit)
      return null;
    if (scenario.limit.kind === "player_ammunition" && m.ammo + ammo > m.limit)
      return null;
  }
  if (type === "shot" || type === "double_shot") {
    if (
      cmd.targets.length !== (type === "shot" ? 1 : 2) ||
      new Set(cmd.targets).size !== cmd.targets.length ||
      cmd.targets.some((c) => !legal(own.knowledge[c]))
    )
      return null;
    for (const c of cmd.targets) retains = shot(m, actor, c) || retains;
    if (actor === 1) m.lastShot = [...cmd.targets];
  } else if (type === "pulse") {
    if (cmd.targets.length !== 1) return null;
    const cs = scanCells(cmd.targets[0]);
    own.scans.push({
      cells: cs,
      count: enemy.fleet
        .flatMap((s) => cells(s).filter((c) => !s.hits.includes(c)))
        .filter((c) => cs.includes(c)).length,
      action: m.action,
    });
    retains = true;
  } else if (type === "guidance") {
    if (cmd.targets.length) return null;
    const targets = enemy.fleet.flatMap((s) =>
      cells(s).filter(
        (c) => !s.hits.includes(c) && own.knowledge[c] === "unknown",
      ),
    );
    if (!targets.length) return null;
    own.knowledge[targets[Math.floor(random(own) * targets.length)]] =
      "revealed";
  } else if (type === "repair") {
    if (cmd.targets.length !== 1) return null;
    const c = cmd.targets[0],
      ship = own.fleet.find((s) => s.hits.includes(c) && !sunk(s));
    if (!ship) return null;
    ship.hits = ship.hits.filter((h) => h !== c);
    enemy.knowledge[c] = "revealed";
    m.events.push({ actor, kind: "restored", cells: [c], action: m.action });
  } else return null;
  if (isAbility) {
    inv[type as Ability]--;
    own.stats.abilities[type as Ability]++;
    m.abilityUsed = true;
    m.events.push({ actor, kind: type, action: m.action });
  }
  m.action++;
  if (actor === 0) {
    m.actions += cost;
    m.ammo += ammo;
  }
  const won =
    actor === 0 &&
    mode === "challenge" &&
    scenario.objective === "destroy_enemy_length_4_ship"
      ? enemy.fleet.some((s) => s.length === 4 && sunk(s))
      : alive(enemy) === 0;
  if (won) finish(next, m, actor, "fleet");
  else if (alive(m.sides[0]) === 0) finish(next, m, 1, "fleet");
  else {
    if (!retains) {
      m.actor = actor === 0 ? 1 : 0;
      m.abilityUsed = false;
    }
    if (actor === 0 && mode === "challenge" && scenario.limit) {
      const used =
        scenario.limit.kind === "player_actions"
          ? m.actions
          : scenario.limit.kind === "player_ammunition"
            ? m.ammo
            : own.stats.misses;
      if (used >= m.limit) {
        if (m.refilled) finish(next, m, 1, "limit");
        else m.stage = "continuation";
      }
    }
  }
  m.updated = Date.now();
  return next;
}
export function reward(
  db: Database,
  mode: Mode,
  a: Ability,
  operation: string,
): boolean {
  if (db.profile.operations.includes(operation)) return false;
  const m = db.slots[mode];
  if (mode === "classic" || !m || !m.started || m.stage === "finished")
    return false;
  if (mode === "challenge") {
    if (m.refilled) return false;
    const scenario = challenges.scenarios[m.scenario];
    if (scenario.limit) {
      if (m.stage !== "continuation") return false;
      m.limit =
        scenario.continuation.new_limit ??
        m.limit + (scenario.continuation.amount ?? 0);
      m.stage = "active";
    } else {
      if (m.actor !== 0 || m.stage !== "active") return false;
      m.sides[0].inventory[a] += a === "pulse" ? 2 : 1;
    }
    m.refilled = true;
  } else db.profile.inventory[a] += a === "pulse" ? 2 : 1;
  db.profile.operations.push(operation);
  m.updated = Date.now();
  return true;
}
export function declineContinuation(db: Database, mode: Mode) {
  const m = db.slots[mode];
  if (m?.stage === "continuation") finish(db, m, 1, "limit");
}
export type BotView = {
  own: Side;
  bot: Bot;
  abilityUsed: boolean;
  mode: Mode;
  remaining: number[];
  events: Match["events"];
};
// Only public observations and the bot's private state cross this boundary.
export function botView(m: Match): BotView {
  const knownSunk: number[] = [];
  const marks = m.sides[1].knowledge;
  const seen = new Set<number>();
  for (let c = 0; c < 100; c++)
    if (marks[c] === "sunk" && !seen.has(c)) {
      const queue = [c];
      seen.add(c);
      for (let i = 0; i < queue.length; i++)
        for (const n of [
          queue[i] - 10,
          queue[i] + 10,
          queue[i] - 1,
          queue[i] + 1,
        ])
          if (
            n >= 0 &&
            n < 100 &&
            marks[n] === "sunk" &&
            near(queue[i], n) &&
            !seen.has(n)
          ) {
            seen.add(n);
            queue.push(n);
          }
      knownSunk.push(queue.length);
    }
  const remaining = fleetLengths(m.mode, m.scenario);
  for (const l of knownSunk) {
    const i = remaining.indexOf(l);
    if (i >= 0) remaining.splice(i, 1);
  }
  return structuredClone({
    own: m.sides[1],
    bot: m.bot,
    abilityUsed: m.abilityUsed,
    mode: m.mode,
    remaining,
    events: m.events,
  });
}
// Sample whole mutually non-touching fleets consistent with public observations.
// Bounded search is deterministic; rejected samples never read a real target board.
function posteriorHeat(
  v: BotView,
  rng: { rng: number },
  scans: { cells: number[]; intact: number }[],
): number[] | null {
  const marks = v.own.knowledge;
  const required = marks.reduce(
    (mask, m, c) =>
      m === "hit" || m === "revealed" ? mask | (1n << BigInt(c)) : mask,
    0n,
  );
  const counts = new Map<number, number>();
  for (const length of v.remaining)
    counts.set(length, (counts.get(length) ?? 0) + 1);
  type Candidate = {
    length: number;
    mask: bigint;
    halo: bigint;
    cs: number[];
    scan: number[];
  };
  const options: Candidate[] = [];
  for (const length of counts.keys())
    for (let nose = 0; nose < 100; nose++)
      for (const heading of (length === 1 ? [0] : [0, 1]) as (0 | 1)[]) {
        const s: Ship = { id: "sample", length, nose, heading, hits: [] };
        if (placementError([], s)) continue;
        const cs = cells(s);
        if (cs.some((c) => ["miss", "empty", "sunk"].includes(marks[c])))
          continue;
        let mask = 0n,
          halo = 0n;
        for (const c of cs) {
          mask |= 1n << BigInt(c);
          for (
            let r = Math.max(0, Math.floor(c / 10) - 1);
            r <= Math.min(9, Math.floor(c / 10) + 1);
            r++
          )
            for (
              let col = Math.max(0, (c % 10) - 1);
              col <= Math.min(9, (c % 10) + 1);
              col++
            )
              halo |= 1n << BigInt(r * 10 + col);
        }
        if ((required & halo & ~mask) !== 0n) continue;
        options.push({
          length,
          mask,
          halo,
          cs,
          scan: scans.map(
            (scan) =>
              cs.filter((c) => marks[c] !== "hit" && scan.cells.includes(c))
                .length,
          ),
        });
      }
  const heat = Array(100).fill(0) as number[];
  let accepted = 0,
    nodes = 0;
  function sample(
    occupied: bigint,
    blocked: bigint,
    left: number,
    totals: number[],
  ): Candidate[] | null {
    if (++nodes > 4500) return null;
    if (!left)
      return (required & ~occupied) === 0n &&
        scans.every((s, i) => s.intact === totals[i])
        ? []
        : null;
    const missing = required & ~occupied;
    const need = missing & -missing;
    const largest = Math.max(
      ...[...counts].filter(([, n]) => n > 0).map(([l]) => l),
    );
    const possible = options.filter(
      (o) =>
        (counts.get(o.length) ?? 0) > 0 &&
        (o.mask & blocked) === 0n &&
        (need ? (o.mask & need) !== 0n : o.length === largest) &&
        o.scan.every((n, i) => n + totals[i] <= scans[i].intact),
    );
    for (let i = possible.length - 1; i > 0; i--) {
      const j = Math.floor(random(rng) * (i + 1));
      [possible[i], possible[j]] = [possible[j], possible[i]];
    }
    for (const o of possible.slice(0, 24)) {
      counts.set(o.length, counts.get(o.length)! - 1);
      const result = sample(
        occupied | o.mask,
        blocked | o.halo,
        left - 1,
        totals.map((n, i) => n + o.scan[i]),
      );
      counts.set(o.length, counts.get(o.length)! + 1);
      if (result) return [o, ...result];
      if (nodes > 4500) break;
    }
    return null;
  }
  while (accepted < 48 && nodes < 4500) {
    const result = sample(
      0n,
      0n,
      v.remaining.length,
      scans.map(() => 0),
    );
    if (result) {
      accepted++;
      for (const o of result)
        for (const c of o.cs) if (legal(marks[c])) heat[c]++;
    }
  }
  return accepted >= 8 ? heat.map((n) => n / accepted) : null;
}
export function botDecision(v: BotView): { command: Command; rng: number } {
  const own = v.own,
    marks = own.knowledge;
  const valid = marks.map((m, c) => (legal(m) ? c : -1)).filter((c) => c >= 0);
  const rng = { rng: own.rng };
  const score = Array(100).fill(0) as number[];
  const hits = marks
    .map((m, c) => (m === "hit" ? c : -1))
    .filter((c) => c >= 0);
  const expert = v.bot.difficulty === "expert";
  const scans = own.scans.map((scan) => ({
    ...scan,
    intact: Math.max(
      0,
      scan.count +
        v.events
          .filter(
            (e) =>
              e.action >= scan.action &&
              e.cells?.some((c) => scan.cells.includes(c)),
          )
          .reduce(
            (delta, e) =>
              delta +
              (e.actor === 1 && (e.kind === "hit" || e.kind === "sunk")
                ? -1
                : e.actor === 0 && e.kind === "restored"
                  ? 1
                  : 0),
            0,
          ),
    ),
  }));
  for (const length of v.remaining)
    for (let c = 0; c < 100; c++)
      for (const heading of [0, 1] as const) {
        const ship: Ship = { id: "", length, nose: c, heading, hits: [] };
        const cs = cells(ship);
        if (
          placementError([], ship) ||
          cs.some((t) => ["miss", "empty", "sunk"].includes(marks[t]))
        )
          continue;
        if (
          expert &&
          hits.some((h) => !cs.includes(h) && cs.some((c) => near(c, h)))
        )
          continue;
        if (
          expert &&
          scans.some(
            (scan) =>
              scan.intact === 0 &&
              cs.some((c) => scan.cells.includes(c) && legal(marks[c])),
          )
        )
          continue;
        const touched = hits.filter((h) => cs.includes(h)).length;
        const weight = touched ? Math.pow(30, touched) : 1;
        for (const t of cs) if (legal(marks[t])) score[t] += weight;
      }
  for (const c of valid) {
    if (marks[c] === "revealed") score[c] += 1e9;
    if (v.bot.difficulty === "medium")
      score[c] =
        (marks[c] === "revealed" ? 1e9 : 0) +
        hits.filter(
          (h) =>
            Math.abs(Math.floor(c / 10) - Math.floor(h / 10)) +
              Math.abs((c % 10) - (h % 10)) ===
            1,
        ).length *
          100 +
        (c % 2 === Math.floor(c / 10) % 2 ? 2 : 1);
    if (expert)
      for (const scan of scans) {
        if (scan.cells.includes(c) && scan.intact > 0)
          score[c] += scan.intact * 2;
      }
  }
  if (expert) {
    const posterior = posteriorHeat(v, rng, scans);
    if (posterior)
      for (const c of valid)
        score[c] =
          marks[c] === "revealed"
            ? 1e9
            : posterior[c] * 1000 + Math.min(score[c], 100) * 0.01;
  }
  const order = valid
    .map((c) => ({
      c,
      s:
        v.bot.difficulty === "easy"
          ? random(rng)
          : score[c] + random(rng) * 0.01,
    }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
  let command: Command = { type: "shot", targets: [order[0]] };
  if (v.mode !== "classic" && !v.abilityUsed) {
    const inv = own.inventory;
    const damaged = own.fleet.filter((s) => !sunk(s)).flatMap((s) => s.hits);
    if (
      inv.repair &&
      damaged.length &&
      (v.bot.personality === "cautious" || random(rng) < 0.3)
    )
      command = { type: "repair", targets: [damaged[0]] };
    else if (inv.double_shot && order.length > 1)
      command = { type: "double_shot", targets: order.slice(0, 2) };
    else if (inv.pulse && !hits.length && own.scans.length < 3)
      command = { type: "pulse", targets: [order[0]] };
    else if (
      inv.guidance &&
      v.remaining.reduce((sum, length) => sum + length, 0) >
        hits.length + marks.filter((m) => m === "revealed").length &&
      !marks.includes("revealed")
    )
      command = { type: "guidance", targets: [] };
  }
  return { command, rng: rng.rng };
}
