import { LocalStorage } from "@raycast/api";

export type TabLastActiveMap = Record<string, number>;

const TAB_LAST_ACTIVE_STORAGE_KEY = "tab-last-active-by-url";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function readTabLastActiveMap(): Promise<TabLastActiveMap> {
  const raw = await LocalStorage.getItem<string>(TAB_LAST_ACTIVE_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    const result: TabLastActiveMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === "string" && typeof value === "number" && Number.isFinite(value)) {
        result[key] = value;
      }
    }

    return result;
  } catch {
    return {};
  }
}

export async function writeTabLastActiveMap(map: TabLastActiveMap): Promise<void> {
  await LocalStorage.setItem(TAB_LAST_ACTIVE_STORAGE_KEY, JSON.stringify(map));
}

export function getTabLastActive(map: TabLastActiveMap, url: string): number {
  return map[url] ?? 0;
}

export function touchTabLastActive(map: TabLastActiveMap, url: string, timestampMs = Date.now()): boolean {
  if (!url) return false;

  const current = map[url] ?? 0;
  if (timestampMs <= current) return false;

  map[url] = timestampMs;
  return true;
}

export function pruneTabLastActiveMap(map: TabLastActiveMap, openUrls: Set<string>, maxEntries = 500): boolean {
  let changed = false;

  for (const key of Object.keys(map)) {
    if (!openUrls.has(key)) {
      delete map[key];
      changed = true;
    }
  }

  const entries = Object.entries(map);
  if (entries.length <= maxEntries) return changed;

  entries.sort((a, b) => b[1] - a[1]);
  for (const [url] of entries.slice(maxEntries)) {
    delete map[url];
    changed = true;
  }

  return changed;
}
