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
  return words[getDailyIndex(baseDate, words)];
}

export function randomWord(words: string[]): string {
  return words[Math.floor(Math.random() * words.length)];
}
