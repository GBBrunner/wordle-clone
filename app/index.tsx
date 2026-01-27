import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TextInput, Platform, Pressable } from 'react-native';
import Board from '../components/Board';
import Keyboard from '../components/Keyboard';
import { ALLOWED_GUESSES, WORDS } from '../data/words';
import { evaluateGuess, getDailyWord, randomWord, isValidGuess } from '../lib/wordle/engine';

const WORD_LEN = 5;
const MAX_ROWS = 6;
const BASE_DATE = new Date('2021-06-19'); // Adjustable base date

type Mode = 'daily' | 'endless';

export default function Home() {
  const [mode, setMode] = useState<Mode>('daily');
  const [secret, setSecret] = useState<string>('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [evaluations, setEvaluations] = useState<ReturnType<typeof evaluateGuess>[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [done, setDone] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [keyStates, setKeyStates] = useState<Record<string, 'correct'|'present'|'absent'>>({});

  useEffect(() => {
    (async () => {
      const word = mode === 'daily' ? await getDailyWord(WORDS, BASE_DATE) : randomWord(WORDS);
      setSecret(word);
      resetGameState();
    })();
  }, [mode]);

  useEffect(() => {
    const handler = (e: any) => {
      const key = e.key;
      if (/^[a-zA-Z]$/.test(key)) onKey(key.toUpperCase());
      else if (key === 'Enter') onKey('ENTER');
      else if (key === 'Backspace') onKey('DEL');
    };
    if (Platform.OS === 'web') {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [current, guesses, done, secret]);

  function resetGameState() {
    setGuesses([]);
    setEvaluations([]);
    setCurrent('');
    setDone(false);
    setMessage('');
    setKeyStates({});
  }

  function onKey(key: string) {
    if (done) return;
    if (key === 'ENTER') return submitGuess();
    if (key === 'DEL') return setCurrent((s) => s.slice(0, -1));
    if (/^[A-Z]$/.test(key)) {
      setCurrent((s) => (s.length < WORD_LEN ? s + key.toLowerCase() : s));
    }
  }

  function submitGuess() {
    if (current.length !== WORD_LEN) return setMessage('Not enough letters');
    if (!ALLOWED_GUESSES.has(current)) return setMessage('Not in word list');
    const evalRow = evaluateGuess(secret, current);
    setGuesses((g) => [...g, current]);
    setEvaluations((e) => [...e, evalRow]);
    setCurrent('');
    setMessage('');

    // Update keyboard states conservatively
    setKeyStates((ks) => {
      const next = { ...ks };
      for (let i = 0; i < WORD_LEN; i++) {
        const ch = current[i];
        const prev = next[ch];
        const now = evalRow[i];
        if (now === 'correct' || (prev !== 'correct' && now === 'present') || (!prev && now === 'absent')) {
          next[ch] = now;
        }
      }
      return next;
    });

    if (current === secret) {
      setDone(true);
      setMessage(mode === 'daily' ? 'You solved today\'s puzzle!' : 'Nice!');
    } else if (guesses.length + 1 >= MAX_ROWS) {
      setDone(true);
      setMessage(`Out of tries. The word was ${secret.toUpperCase()}`);
    }
  }

  function startEndless() {
    setMode('endless');
  }

  function newEndlessGame() {
    setSecret(randomWord(WORDS));
    resetGameState();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Wordle (Daily + Endless)</Text>
        <View style={styles.modeRow}>
          <Pressable onPress={() => setMode('daily')} style={[styles.modeBtn, mode==='daily' && styles.modeActive]}>
            <Text style={styles.modeText}>Daily</Text>
          </Pressable>
          <Pressable onPress={() => setMode('endless')} style={[styles.modeBtn, mode==='endless' && styles.modeActive]}>
            <Text style={styles.modeText}>Endless</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.boardWrap}>
        <Board guesses={guesses} evaluations={evaluations} currentGuess={current} />
      </View>

      {!!message && <Text style={styles.message}>{message}</Text>}

      {!done ? (
        <Keyboard onKey={onKey} keyStates={keyStates} />
      ) : (
        <View style={{ gap: 8 }}>
          {mode === 'daily' ? (
            <Pressable onPress={startEndless} style={styles.cta}>
              <Text style={styles.ctaText}>Play Endless Mode</Text>
            </Pressable>
          ) : (
            <Pressable onPress={newEndlessGame} style={styles.cta}>
              <Text style={styles.ctaText}>New Endless Game</Text>
            </Pressable>
          )}
        </View>
      )}

      {Platform.OS !== 'web' && (
        <TextInput style={styles.hiddenInput} value={current} onChangeText={(t)=>{}} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121213', padding: 16, gap: 12 },
  header: { alignItems: 'center', gap: 8 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { backgroundColor: '#3a3a3c', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  modeActive: { backgroundColor: '#6aaa64' },
  modeText: { color: '#fff', fontWeight: '700' },
  boardWrap: { alignItems: 'center' },
  message: { color: '#fff', textAlign: 'center' },
  cta: { backgroundColor: '#6aaa64', borderRadius: 6, padding: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700' },
  hiddenInput: { height: 0, width: 0 },
});
