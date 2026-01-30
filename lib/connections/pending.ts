import { Platform } from "react-native";

export type PendingConnectionsEvent =
  | {
      type: "win";
      date: string;
      mistakesUsed: number;
      createdAt: number;
    }
  | {
      type: "loss";
      date: string;
      createdAt: number;
    };

export type PendingConnectionsProgress = {
  date: string;
  mistakesLeft: number;
  solvedCategoryIndexes: number[];
  updatedAt: number;
};

const EVENTS_KEY = "pending_connections_events_v1";
const PROGRESS_KEY = "pending_connections_progress_v1";

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

function clampInt(n: unknown, min: number, max: number): number | null {
  const v = Number(n);
  if (!Number.isFinite(v) || !Number.isInteger(v)) return null;
  if (v < min || v > max) return null;
  return v;
}

function normalizeSolvedIndexes(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const x of v) {
    const n = clampInt(x, 0, 3);
    if (n == null) return null;
    out.push(n);
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

// -------- Events --------

function readEvents(): PendingConnectionsEvent[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const out: PendingConnectionsEvent[] = [];
    for (const e of parsed) {
      if (!e || typeof e !== "object") continue;
      const type = (e as any).type;
      const date = (e as any).date;
      if (type !== "win" && type !== "loss") continue;
      if (typeof date !== "string" || !isValidDate(date)) continue;
      const createdAt = Number((e as any).createdAt) || Date.now();

      if (type === "win") {
        const mistakesUsed = clampInt((e as any).mistakesUsed, 0, 4);
        if (mistakesUsed == null) continue;
        out.push({ type: "win", date, mistakesUsed, createdAt });
      } else {
        out.push({ type: "loss", date, createdAt });
      }
    }

    return out;
  } catch {
    return [];
  }
}

function writeEvents(events: PendingConnectionsEvent[]) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

export function queuePendingConnectionsEvent(event: PendingConnectionsEvent) {
  if (!canUseLocalStorage()) return;
  const events = readEvents();
  events.push(event);
  writeEvents(events);
}

export function clearPendingConnectionsEvents() {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(EVENTS_KEY);
  } catch {
    // ignore
  }
}

export async function flushPendingConnectionsEvents(): Promise<{
  flushed: number;
  remaining: number;
}> {
  const events = readEvents();
  if (events.length === 0) return { flushed: 0, remaining: 0 };

  clearPendingConnectionsEvents();

  let flushed = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    try {
      if (e.type === "win") {
        const res = await fetch("/api/connections/win", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ mistakesUsed: e.mistakesUsed }),
        });
        if (!res.ok) throw new Error("win_failed");
      } else {
        const res = await fetch("/api/connections/loss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!res.ok) throw new Error("loss_failed");
      }
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

function readProgressMap(): Record<string, PendingConnectionsProgress> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const out: Record<string, PendingConnectionsProgress> = {};
    for (const [date, value] of Object.entries(parsed)) {
      if (!isValidDate(date)) continue;
      const v: any = value;
      if (!v || typeof v !== "object") continue;
      const mistakesLeft = clampInt(v.mistakesLeft, 0, 4);
      const solvedCategoryIndexes = normalizeSolvedIndexes(
        v.solvedCategoryIndexes,
      );
      if (mistakesLeft == null || solvedCategoryIndexes == null) continue;
      out[date] = {
        date,
        mistakesLeft,
        solvedCategoryIndexes,
        updatedAt: Number(v.updatedAt) || Date.now(),
      };
    }

    return out;
  } catch {
    return {};
  }
}

function writeProgressMap(map: Record<string, PendingConnectionsProgress>) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function queuePendingConnectionsProgress(input: {
  date: string;
  mistakesLeft: number;
  solvedCategoryIndexes: number[];
}) {
  if (!canUseLocalStorage()) return;
  if (!isValidDate(input.date)) return;
  const mistakesLeft = clampInt(input.mistakesLeft, 0, 4);
  const solvedCategoryIndexes = normalizeSolvedIndexes(
    input.solvedCategoryIndexes,
  );
  if (mistakesLeft == null || solvedCategoryIndexes == null) return;

  const map = readProgressMap();
  map[input.date] = {
    date: input.date,
    mistakesLeft,
    solvedCategoryIndexes,
    updatedAt: Date.now(),
  };

  // Cap to most recent 14 days
  const entries = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
  const trimmed = entries.slice(0, 14);
  const next: Record<string, PendingConnectionsProgress> = {};
  for (const e of trimmed) next[e.date] = e;
  writeProgressMap(next);
}

export function getPendingConnectionsProgress(
  date: string,
): PendingConnectionsProgress | null {
  if (!isValidDate(date)) return null;
  const map = readProgressMap();
  return map[date] || null;
}

export function clearPendingConnectionsProgress(date?: string) {
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

export async function flushPendingConnectionsProgresses(): Promise<{
  flushed: number;
  remaining: number;
}> {
  const map = readProgressMap();
  const all = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  if (all.length === 0) return { flushed: 0, remaining: 0 };

  clearPendingConnectionsProgress();

  let flushed = 0;
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    try {
      const res = await fetch("/api/connections/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: p.date,
          mistakesLeft: p.mistakesLeft,
          solvedCategoryIndexes: p.solvedCategoryIndexes,
        }),
      });
      if (!res.ok) throw new Error("progress_failed");
      flushed++;
    } catch {
      const remaining = all.slice(i);
      const restore: Record<string, PendingConnectionsProgress> = {};
      for (const r of remaining) restore[r.date] = r;
      writeProgressMap(restore);
      return { flushed, remaining: remaining.length };
    }
  }

  return { flushed, remaining: 0 };
}
