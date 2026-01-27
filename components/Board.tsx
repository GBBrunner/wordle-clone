import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import type { Evaluation } from '../lib/wordle/engine';

type Props = {
  guesses: string[];
  evaluations: Evaluation[];
  currentGuess: string;
  rows?: number;
  cols?: number;
};

export default function Board({ guesses, evaluations, currentGuess, rows = 6, cols = 5 }: Props) {
  const grid: { char: string; state: 'empty' | 'filled'; eval?: Evaluation[number] }[][] = [];

  // Animated values per cell
  const scaleAnimsRef = useRef<Animated.Value[][]>([]);
  const flipAnimsRef = useRef<Animated.Value[][]>([]); // 0 -> 1 mapped to rotateX
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({});

  // Ensure animation matrix size
  if (scaleAnimsRef.current.length !== rows) {
    scaleAnimsRef.current = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => new Animated.Value(1))
    );
  } else {
    for (let r = 0; r < rows; r++) {
      if (!scaleAnimsRef.current[r] || scaleAnimsRef.current[r].length !== cols) {
        scaleAnimsRef.current[r] = Array.from({ length: cols }, () => new Animated.Value(1));
      }
    }
  }
  if (flipAnimsRef.current.length !== rows) {
    flipAnimsRef.current = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => new Animated.Value(0))
    );
  } else {
    for (let r = 0; r < rows; r++) {
      if (!flipAnimsRef.current[r] || flipAnimsRef.current[r].length !== cols) {
        flipAnimsRef.current[r] = Array.from({ length: cols }, () => new Animated.Value(0));
      }
    }
  }
  for (let r = 0; r < rows; r++) {
    const row: { char: string; state: 'empty' | 'filled'; eval?: Evaluation[number] }[] = [];
    const guess = r < guesses.length ? guesses[r] : r === guesses.length ? currentGuess : '';
    const evalRow = r < evaluations.length ? evaluations[r] : undefined;
    for (let c = 0; c < cols; c++) {
      const char = guess[c]?.toUpperCase() ?? '';
      const state = char ? 'filled' : 'empty';
      const cellEval = evalRow ? evalRow[c] : undefined;
      row.push({ char, state, eval: cellEval });
    }
    grid.push(row);
  }

  // Trigger reveal animation for the latest evaluated row
  useEffect(() => {
    const r = evaluations.length - 1;
    if (r >= 0 && r < rows) {
      for (let c = 0; c < cols; c++) {
        const delay = c * 160; // cascade across the row
        const animScale = scaleAnimsRef.current[r][c];
        const animFlip = flipAnimsRef.current[r][c];
        // Make color visible right when each tile's animation begins
        const key = `${r}-${c}`;
        setTimeout(() => {
          setRevealedMap((prev) => ({ ...prev, [key]: true }));
        }, delay);

        Animated.sequence([
          Animated.delay(delay),
          // Tilt forward with subtle pop, then return upright (avoids upside-down text)
          Animated.parallel([
            Animated.timing(animFlip, {
              toValue: 1,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(animScale, {
              toValue: 1.08,
              duration: 140,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(animFlip, {
              toValue: 0,
              duration: 180,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(animScale, {
              toValue: 1,
              friction: 7,
              tension: 90,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      }
    }
  }, [evaluations, rows, cols]);

  return (
    <View style={styles.board}>
      {grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) => {
            const rotateX = flipAnimsRef.current[r][c].interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '180deg'],
            });
            const key = `${r}-${c}`;
            return (
              <Animated.View
                key={c}
                style={[
                  styles.cell,
                  styles[cell.state],
                  // Apply eval color as soon as the cell's reveal animation starts
                  cell.eval && revealedMap[key] ? styles[cell.eval] : null,
                  {
                    transform: [
                      { perspective: 600 },
                      { rotateX },
                      { scale: scaleAnimsRef.current[r][c] },
                    ],
                  },
                ]}
              >
                <Text style={styles.cellText}>{cell.char}</Text>
              </Animated.View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { gap: 8, paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 8 },
  cell: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  cellText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  empty: {},
  filled: { borderColor: '#888' },
  correct: { backgroundColor: '#6aaa64', borderColor: '#6aaa64' },
  present: { backgroundColor: '#c9b458', borderColor: '#c9b458' },
  absent: { backgroundColor: '#3a3a3c', borderColor: '#3a3a3c' },
  
});
