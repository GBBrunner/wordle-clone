import { formatYYYYMMDDInTimeZone } from "@/lib/wordle/engine";
import type { StrandsPuzzle, StrandsSubmitResult } from "./types";

export function getNYTStrandsDateString(today = new Date()): string {
  return formatYYYYMMDDInTimeZone(today, "America/New_York");
}

export async function fetchStrandsPuzzle(
  date = getNYTStrandsDateString(),
): Promise<StrandsPuzzle> {
  const proxyBase = process.env.EXPO_PUBLIC_STRANDS_NYT_PROXY_URL;
  const candidates: string[] = [];
  if (proxyBase) candidates.push(`${proxyBase.replace(/\/$/, "")}/${date}`);
  candidates.push(`/api/strands/${date}`);

  const isBrowser =
    typeof window !== "undefined" && typeof document !== "undefined";
  if (!isBrowser) {
    // For native or SSR environments, attempt direct fetch as a fallback.
    candidates.push(`https://www.nytimes.com/svc/strands/v2/${date}.json`);
  }

  let lastError: unknown;
  for (const url of candidates) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const json = (await resp.json()) as any;
      if (!json || typeof json !== "object") continue;

      // Accept both the trimmed proxy payload and the upstream payload.
      const startingBoard: unknown = json.startingBoard ?? json.starting_board;
      const clue: unknown = json.clue;

      if (!Array.isArray(startingBoard) || typeof clue !== "string") continue;

      const rows = Number(json.rows || (startingBoard as any[]).length || 0);
      const cols = Number(
        json.cols || String((startingBoard as any[])[0] ?? "").length || 0,
      );

      const out: StrandsPuzzle = {
        status: String(json.status || "OK"),
        id: Number(json.id || 0),
        printDate: String(json.printDate || json.print_date || date),
        clue,
        startingBoard: startingBoard as string[],
        rows: Number.isFinite(rows) ? rows : 0,
        cols: Number.isFinite(cols) ? cols : 0,
        themeWordCount: Number(
          json.themeWordCount ||
            json.theme_word_count ||
            (Array.isArray(json.themeWords) ? json.themeWords.length : 0) ||
            0,
        ),
      };

      if (!out.startingBoard.every((r) => typeof r === "string")) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(out.printDate)) out.printDate = date;
      if (!Number.isFinite(out.themeWordCount) || out.themeWordCount < 0)
        out.themeWordCount = 0;

      return out;
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error(
    `Failed to fetch Strands puzzle for ${date}. Last error: ${String(
      lastError ?? "unknown",
    )}`,
  );
}

export async function submitStrandsWord(input: {
  date: string;
  word: string;
}): Promise<StrandsSubmitResult> {
  const res = await fetch("/api/strands/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("submit_failed");
  const data = (await res.json()) as any;
  const kind = data?.kind;
  const word = data?.word;
  if (kind !== "theme" && kind !== "spangram" && kind !== "other") {
    throw new Error("invalid_submit_response");
  }
  if (typeof word !== "string") throw new Error("invalid_submit_response");
  return { kind, word };
}
