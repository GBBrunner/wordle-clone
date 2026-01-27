// Word lists by length
import WORDS_4 from './4_letter_words.json';
import WORDS_5 from './5_letter_words.json';
import WORDS_6 from './6_letter_words.json';

export const WORDS_BY_LEN: Record<number, string[]> = {
	4: WORDS_4,
	5: WORDS_5,
	6: WORDS_6,
};

export function getWordsForLength(len: number): string[] {
	return WORDS_BY_LEN[len] ?? [];
}

export function getAllowedGuessesSet(len: number): Set<string> {
	return new Set(getWordsForLength(len));
}
