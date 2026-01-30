import { Platform } from "react-native";

export type PendingWordleEvent =
  | {
      type: "win";
      guessCount: number;
      createdAt: number;
    }
  | {
      type: "loss";
      createdAt: number;
    };

export type PendingWordleProgress = {
  date: string;
  guesses: string[];
  cols: number;
  updatedAt: number;
};

const EVENTS_KEY = "pending_wordle_events_v1";
const PROGRESS_KEY = "pending_wordle_progress_v1";

function canUseLocalStorage(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function readAll(): PendingWordleEvent[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((e) => e && typeof e === "object")
      .filter((e) => e.type === "win" || e.type === "loss")
      .map((e) => {
        if (e.type === "win") {
          return {
            type: "win",
            guessCount: Number(e.guessCount),
            createdAt: Number(e.createdAt) || Date.now(),
          } as PendingWordleEvent;
        }
        return {
          type: "loss",
          createdAt: Number(e.createdAt) || Date.now(),
        } as PendingWordleEvent;
      })
      .filter((e) => (e.type === "win" ? Number.isFinite(e.guessCount) : true));
  } catch {
    return [];
  }
}

function writeAll(events: PendingWordleEvent[]) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

export function queuePendingWordleEvent(event: PendingWordleEvent) {
  const events = readAll();
  events.push(event);
  writeAll(events);
}

export function peekPendingWordleEvents(): PendingWordleEvent[] {
  return readAll();
}

export function clearPendingWordleEvents() {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(EVENTS_KEY);
  } catch {
    // ignore
  }
}

export async function flushPendingWordleEvents(): Promise<{
  flushed: number;
  remaining: number;
}> {
  const events = readAll();
  if (events.length === 0) return { flushed: 0, remaining: 0 };

  // Optimistically clear; if a request fails we re-queue remaining.
  clearPendingWordleEvents();

  let flushed = 0;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    try {
      if (e.type === "win") {
        const res = await fetch("/api/wordle/win", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ guessCount: e.guessCount }),
        });
        if (!res.ok) throw new Error("win_failed");
      } else {
        const res = await fetch("/api/wordle/loss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!res.ok) throw new Error("loss_failed");
      }
      flushed++;
    } catch {
      // Re-queue this event and everything after it.
      const remaining = events.slice(i);
      writeAll(remaining);
      return { flushed, remaining: remaining.length };
    }
  }

  return { flushed, remaining: 0 };
}

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function readProgressMap(): Record<string, PendingWordleProgress> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, PendingWordleProgress> = {};
    for (const [date, value] of Object.entries(parsed)) {
      const v: any = value;
      if (!isValidDate(date)) continue;
      if (!v || typeof v !== "object") continue;
      const guesses = Array.isArray(v.guesses) ? v.guesses : [];
      if (!guesses.every((g: any) => typeof g === "string")) continue;
      const cols = Number(v.cols);
      if (!Number.isFinite(cols) || cols <= 0 || cols > 10) continue;
      out[date] = {
        date,
        guesses,
        cols,
        updatedAt: Number(v.updatedAt) || Date.now(),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeProgressMap(map: Record<string, PendingWordleProgress>) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function queuePendingWordleProgress(input: {
  date: string;
  guesses: string[];
  cols: number;
}) {
  if (!canUseLocalStorage()) return;
  if (!isValidDate(input.date)) return;
  if (
    !Array.isArray(input.guesses) ||
    !input.guesses.every((g) => typeof g === "string")
  )
    return;
  if (!Number.isFinite(input.cols) || input.cols <= 0 || input.cols > 10)
    return;

  const map = readProgressMap();
  map[input.date] = {
    date: input.date,
    guesses: input.guesses,
    cols: input.cols,
    updatedAt: Date.now(),
  };

  // Best-effort cap: keep only the most recent 14 days
  const entries = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
  const trimmed = entries.slice(0, 14);
  const next: Record<string, PendingWordleProgress> = {};
  for (const e of trimmed) next[e.date] = e;
  writeProgressMap(next);
}

export function getPendingWordleProgress(
  date: string,
): PendingWordleProgress | null {
  if (!isValidDate(date)) return null;
  const map = readProgressMap();
  return map[date] || null;
}

export function clearPendingWordleProgress(date?: string) {
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

export async function flushPendingWordleProgresses(): Promise<{
  flushed: number;
  remaining: number;
}> {
  const map = readProgressMap();
  const all = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  if (all.length === 0) return { flushed: 0, remaining: 0 };

  // Optimistically clear; if a request fails we restore remaining.
  clearPendingWordleProgress();

  let flushed = 0;
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    try {
      const res = await fetch("/api/wordle/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: p.date,
          guesses: p.guesses,
          cols: p.cols,
        }),
      });
      if (!res.ok) throw new Error("progress_failed");
      flushed++;
    } catch {
      const remaining = all.slice(i);
      const restore: Record<string, PendingWordleProgress> = {};
      for (const r of remaining) restore[r.date] = r;
      writeProgressMap(restore);
      return { flushed, remaining: remaining.length };
    }
  }

  return { flushed, remaining: 0 };
}
