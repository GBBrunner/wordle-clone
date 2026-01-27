// Generated from data/5_letter_words via scripts/build-wordlist.js
import WORDS_JSON from './5_letter_words.json';

export const WORDS: string[] = WORDS_JSON;
export const ALLOWED_GUESSES: Set<string> = new Set(WORDS);
