import { Platform } from "react-native";

export type PendingStrandsEvent =
  | { type: "win"; date: string; createdAt: number }
  | { type: "loss"; date: string; createdAt: number };

export type PendingStrandsProgress = {
  date: string;
  foundThemeWords: string[];
  foundSpangram: boolean;
  foundPaths: Array<{
    kind: "theme" | "spangram";
    word: string;
    coords: Array<{ r: number; c: number }>;
  }>;
  gaveUp: boolean;
  updatedAt: number;
};

const EVENTS_KEY = "pending_strands_events_v1";
const PROGRESS_KEY = "pending_strands_progress_v1";

function canUseLocalStorage(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function normalizeWord(w: unknown): string | null {
  if (typeof w !== "string") return null;
  const s = w.trim().toUpperCase();
  if (!/^[A-Z]{2,}$/.test(s)) return null;
  return s;
}

function clampInt(n: unknown, min: number, max: number): number | null {
  const v = Number(n);
  if (!Number.isFinite(v) || !Number.isInteger(v)) return null;
  if (v < min || v > max) return null;
  return v;
}

function normalizeFoundPaths(v: unknown): PendingStrandsProgress["foundPaths"] {
  if (!Array.isArray(v)) return [];
  const out: PendingStrandsProgress["foundPaths"] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const kind = (item as any).kind;
    const word = normalizeWord((item as any).word);
    const coordsRaw = (item as any).coords;
    if (kind !== "theme" && kind !== "spangram") continue;
    if (!word) continue;
    if (
      !Array.isArray(coordsRaw) ||
      coordsRaw.length < 2 ||
      coordsRaw.length > 80
    )
      continue;
    const coords: Array<{ r: number; c: number }> = [];
    let ok = true;
    for (const c of coordsRaw) {
      const r = clampInt((c as any)?.r, 0, 50);
      const cc = clampInt((c as any)?.c, 0, 50);
      if (r == null || cc == null) {
        ok = false;
        break;
      }
      coords.push({ r, c: cc });
    }
    if (!ok) continue;
    out.push({ kind, word, coords });
  }

  // De-dupe by kind+word, keep first occurrence.
  const seen = new Set<string>();
  const dedup: PendingStrandsProgress["foundPaths"] = [];
  for (const p of out) {
    const k = `${p.kind}:${p.word}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(p);
  }
  return dedup;
}

// -------- Events --------

function readEvents(): PendingStrandsEvent[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const out: PendingStrandsEvent[] = [];
    for (const e of parsed) {
      if (!e || typeof e !== "object") continue;
      const type = (e as any).type;
      const date = (e as any).date;
      if ((type !== "win" && type !== "loss") || typeof date !== "string")
        continue;
      if (!isValidDate(date)) continue;
      const createdAt = Number((e as any).createdAt) || Date.now();
      out.push({ type, date, createdAt } as PendingStrandsEvent);
    }
    return out;
  } catch {
    return [];
  }
}

function writeEvents(events: PendingStrandsEvent[]) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

export function queuePendingStrandsEvent(event: PendingStrandsEvent) {
  if (!canUseLocalStorage()) return;
  const events = readEvents();
  events.push(event);
  writeEvents(events);
}

export function clearPendingStrandsEvents() {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(EVENTS_KEY);
  } catch {
    // ignore
  }
}

export async function flushPendingStrandsEvents(): Promise<{
  flushed: number;
  remaining: number;
}> {
  const events = readEvents();
  if (events.length === 0) return { flushed: 0, remaining: 0 };

  clearPendingStrandsEvents();

  let flushed = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    try {
      const endpoint =
        e.type === "win" ? "/api/strands/win" : "/api/strands/loss";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: e.date }),
      });
      if (!res.ok) throw new Error("event_failed");
      flushed++;
    } catch {
      const remaining = events.slice(i);
      writeEvents(remaining);
      return { flushed, remaining: remaining.length };
    }
  }

  return { flushed, remaining: 0 };
}

// -------- Progress --------

function readProgressMap(): Record<string, PendingStrandsProgress> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const out: Record<string, PendingStrandsProgress> = {};
    for (const [date, value] of Object.entries(parsed)) {
      if (!isValidDate(date)) continue;
      const v: any = value;
      if (!v || typeof v !== "object") continue;
      const foundThemeWordsRaw = Array.isArray(v.foundThemeWords)
        ? v.foundThemeWords
        : Array.isArray(v.foundWords)
          ? v.foundWords
          : [];
      const foundThemeWords = foundThemeWordsRaw
        .map(normalizeWord)
        .filter((x: string | null): x is string => !!x);
      const foundSpangram = Boolean(v.foundSpangram);
      const foundPaths = normalizeFoundPaths(v.foundPaths);
      const gaveUp = Boolean(v.gaveUp);
      out[date] = {
        date,
        foundThemeWords: Array.from(new Set(foundThemeWords)),
        foundSpangram,
        foundPaths,
        gaveUp,
        updatedAt: Number(v.updatedAt) || Date.now(),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeProgressMap(map: Record<string, PendingStrandsProgress>) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function queuePendingStrandsProgress(input: {
  date: string;
  foundThemeWords: string[];
  foundSpangram: boolean;
  foundPaths: PendingStrandsProgress["foundPaths"];
  gaveUp: boolean;
}) {
  if (!canUseLocalStorage()) return;
  if (!isValidDate(input.date)) return;
  if (!Array.isArray(input.foundThemeWords)) return;

  const foundThemeWords = input.foundThemeWords
    .map(normalizeWord)
    .filter((x: string | null): x is string => !!x);

  const foundPaths = normalizeFoundPaths(input.foundPaths);

  const map = readProgressMap();
  map[input.date] = {
    date: input.date,
    foundThemeWords: Array.from(new Set(foundThemeWords)),
    foundSpangram: Boolean(input.foundSpangram),
    foundPaths,
    gaveUp: Boolean(input.gaveUp),
    updatedAt: Date.now(),
  };

  // Cap to most recent 14 days
  const entries = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
  const trimmed = entries.slice(0, 14);
  const next: Record<string, PendingStrandsProgress> = {};
  for (const e of trimmed) next[e.date] = e;
  writeProgressMap(next);
}

export function getPendingStrandsProgress(
  date: string,
): PendingStrandsProgress | null {
  if (!isValidDate(date)) return null;
  const map = readProgressMap();
  return map[date] || null;
}

export function clearPendingStrandsProgress(date?: string) {
  if (!canUseLocalStorage()) return;
  if (!date) {
    try {
      window.localStorage.removeItem(PROGRESS_KEY);
    } catch {
      // ignore
    }
    return;
  }
  if (!isValidDate(date)) return;
  const map = readProgressMap();
  delete map[date];
  writeProgressMap(map);
}

export async function flushPendingStrandsProgresses(): Promise<{
  flushed: number;
  remaining: number;
}> {
  const map = readProgressMap();
  const all = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  if (all.length === 0) return { flushed: 0, remaining: 0 };

  clearPendingStrandsProgress();

  let flushed = 0;
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    try {
      const res = await fetch("/api/strands/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: p.date,
          foundThemeWords: p.foundThemeWords,
          foundSpangram: p.foundSpangram,
          foundPaths: p.foundPaths,
          gaveUp: p.gaveUp,
        }),
      });
      if (!res.ok) throw new Error("progress_failed");
      flushed++;
    } catch {
      const remaining = all.slice(i);
      const restore: Record<string, PendingStrandsProgress> = {};
      for (const r of remaining) restore[r.date] = r;
      writeProgressMap(restore);
      return { flushed, remaining: remaining.length };
    }
  }

  return { flushed, remaining: 0 };
}
