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
  if (data.version !== 1 || !data.profile || !data.slots)
    throw Error("Unsupported save version");
  return data;
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
