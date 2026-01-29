import { formatYYYYMMDDInTimeZone } from "@/lib/wordle/engine";
import type { ConnectionsPuzzle } from "./types";

export function getNYTConnectionsDateString(today = new Date()): string {
  // Matches NYT puzzle date based on America/New_York.
  return formatYYYYMMDDInTimeZone(today, "America/New_York");
}

export async function fetchConnectionsPuzzle(
  date = getNYTConnectionsDateString(),
): Promise<ConnectionsPuzzle> {
  const proxyBase = process.env.EXPO_PUBLIC_CONNECTIONS_NYT_PROXY_URL;
  const candidates: string[] = [];
  if (proxyBase) candidates.push(`${proxyBase.replace(/\/$/, "")}/${date}`);
  candidates.push(`/api/connections/${date}`);

  const isBrowser =
    typeof window !== "undefined" && typeof document !== "undefined";
  if (!isBrowser) {
    candidates.push(`https://www.nytimes.com/svc/connections/v2/${date}.json`);
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const resp = await fetch(candidate);
      if (!resp.ok) continue;
      const json = (await resp.json()) as ConnectionsPuzzle;
      if (!json || !Array.isArray((json as any).categories)) continue;
      return json;
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error(
    `Failed to fetch Connections puzzle for ${date}. Last error: ${String(
      lastError ?? "unknown",
    )}`,
  );
}
