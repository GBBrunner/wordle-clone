export type LetterResult = 'correct' | 'present' | 'absent';
export type Evaluation = LetterResult[];

export function evaluateGuess(secret: string, guess: string): Evaluation {
  const n = secret.length;
  const res: LetterResult[] = new Array(n).fill('absent');
  const secretChars = secret.split('');
  const guessChars = guess.split('');

  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const s = secretChars[i];
    counts[s] = (counts[s] ?? 0) + 1;
  }

  for (let i = 0; i < n; i++) {
    if (guessChars[i] === secretChars[i]) {
      res[i] = 'correct';
      counts[guessChars[i]]!--;
    }
  }

  for (let i = 0; i < n; i++) {
    if (res[i] === 'correct') continue;
    const g = guessChars[i];
    if ((counts[g] ?? 0) > 0) {
      res[i] = 'present';
      counts[g]!--;
    }
  }

  return res;
}

export function isValidGuess(word: string, len: number) {
  const re = new RegExp(`^[a-zA-Z]{${len}}$`);
  return re.test(word);
}

export function getDailyIndex(baseDate: Date, words: string[], today = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((stripTime(today).getTime() - stripTime(baseDate).getTime()) / msPerDay);
  return ((days % words.length) + words.length) % words.length;
}

export function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatYYYYMMDDInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Failed to format date');
  return `${year}-${month}-${day}`;
}

export function getNYTWordleDateString(today = new Date()): string {
  // NYT Wordle date is based on America/New_York.
  return formatYYYYMMDDInTimeZone(today, 'America/New_York');
}

export async function getDailyWord(words: string[], baseDate: Date): Promise<string> {
  const url = process.env.EXPO_PUBLIC_DAILY_WORD_URL;
  if (url) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const text = (await resp.text()).trim().toLowerCase();
        if (isValidGuess(text, words[0]?.length ?? 5)) return text;
      }
    } catch (e) {
      // fall back to local algorithm
    }
  }

  // Default: try the NYT Wordle daily solution first.
  // - Web often needs a proxy due to CORS; /api/wordle/:date is provided for Vercel.
  // - Native may be able to hit NYT directly.
  const len = words[0]?.length ?? 5;
  const date = getNYTWordleDateString();
  const proxyBase = process.env.EXPO_PUBLIC_WORDLE_NYT_PROXY_URL;
  const candidates: string[] = [];
  if (proxyBase) candidates.push(`${proxyBase.replace(/\/$/, '')}/${date}`);
  candidates.push(`/api/wordle/${date}`);

  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (!isBrowser) {
    // Browsers cannot read this response due to CORS, but native runtimes usually can.
    candidates.push(`https://www.nytimes.com/svc/wordle/v2/${date}.json`);
  }

  for (const candidate of candidates) {
    try {
      const resp = await fetch(candidate);
      if (!resp.ok) continue;
      const json = (await resp.json()) as { solution?: unknown };
      const solution =
        typeof json?.solution === 'string' ? json.solution.trim().toLowerCase() : '';
      if (isValidGuess(solution, len)) return solution;
    } catch {
      // try next candidate
    }
  }

  return words[getDailyIndex(baseDate, words)];
}

export function randomWord(words: string[]): string {
  return words[Math.floor(Math.random() * words.length)];
}
