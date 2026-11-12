import { freshDatabase } from "./engine.ts";
import type { Database } from "./engine.ts";
export const testMode =
  new URLSearchParams(location.search).get("devAds") === "1";
export const storageKey = testMode ? "armada.v1.test" : "armada.v1";
let lastWritten: string | null = null;
export function load(): Database {
  const raw = localStorage.getItem(storageKey);
  lastWritten = raw;
  if (!raw) return freshDatabase();
  const data = JSON.parse(raw) as Database;
  if (!validDatabase(data)) throw Error("Unsupported save version");
  return data;
}
// Stored JSON is untrusted input, even when its version number is correct.
// Validate before rendering; never replace an unreadable profile with a fresh save.
function validDatabase(data: Database): boolean {
  const inventoryValid = (value: Database["profile"]["inventory"]) =>
    !!value &&
    ["pulse", "guidance", "double_shot", "repair"].every((key) => {
      const n = value[key as keyof typeof value];
      return Number.isSafeInteger(n) && n >= 0;
    });
  const p = data?.profile;
  if (data?.version !== 1 || !p || !data.slots || Array.isArray(data.slots))
    return false;
  if (
    !p.settings ||
    !["ru", "en"].includes(p.settings.lang) ||
    !Number.isFinite(p.settings.music) ||
    !Number.isFinite(p.settings.effects) ||
    typeof p.settings.reduced !== "boolean" ||
    !inventoryValid(p.inventory) ||
    typeof p.freeStartEligible !== "boolean" ||
    !Array.isArray(p.operations) ||
    !Array.isArray(p.recent) ||
    !Array.isArray(p.history) ||
    !p.results
  )
    return false;
  return Object.entries(data.slots).every(
    ([mode, m]) =>
      ["classic", "tactical", "challenge"].includes(mode) &&
      !!m &&
      m.mode === mode &&
      typeof m.id === "string" &&
      ["setup", "active", "continuation", "finished"].includes(m.stage) &&
      (m.actor === 0 || m.actor === 1) &&
      !!m.bot &&
      typeof m.bot.nickname === "string" &&
      Array.isArray(m.events) &&
      Array.isArray(m.lastShot) &&
      Array.isArray(m.sides) &&
      m.sides.length === 2 &&
      m.sides.every(
        (s) =>
          !!s &&
          Array.isArray(s.fleet) &&
          Array.isArray(s.knowledge) &&
          s.knowledge.length === 100 &&
          Array.isArray(s.scans) &&
          inventoryValid(s.inventory) &&
          !!s.stats &&
          inventoryValid(s.stats.abilities) &&
          Number.isFinite(s.rng) &&
          s.fleet.every(
            (ship) =>
              !!ship &&
              typeof ship.id === "string" &&
              Number.isInteger(ship.length) &&
              ship.length >= 1 &&
              ship.length <= 4 &&
              Number.isInteger(ship.nose) &&
              (ship.heading === 0 || ship.heading === 1) &&
              Array.isArray(ship.hits),
          ),
      ),
  );
}
// One atomic localStorage value contains profile + three independent snapshots.
// Failed writes throw before the application replaces its in-memory database.
export function commit(data: Database) {
  if (localStorage.getItem(storageKey) !== lastWritten)
    throw Error("Save changed in another tab. Reload to continue.");
  const serialized = JSON.stringify(data);
  localStorage.setItem(storageKey, serialized);
  lastWritten = serialized;
}
