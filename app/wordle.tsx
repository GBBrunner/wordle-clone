"use client";

import { useAuth } from "@/hooks/use-auth";
import { useAppTheme } from "@/lib/theme/context";
import { readableTextOn } from "@/lib/theme/theme";
// On web, persistence is handled via serverless API using Firebase Admin.
// We avoid client Firestore writes to prevent auth/rules issues.
import React, { useEffect, useRef, useState } from "react";
import {
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
  Modal,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";
import Board from "../components/Board";
import Keyboard from "../components/Keyboard";
import StatsChart from "../components/StatsChart";
import { getAllowedGuessesSet, getWordsForLength } from "../data/words";
import { evaluateGuess, getDailyWord, randomWord } from "../lib/wordle/engine";

const DAILY_WORD_LEN = 5;
const MAX_ROWS = 6;
const BASE_DATE = new Date("2021-06-19");

type Mode = "daily" | "endless";

export default function WordlePage() {
  const { colors } = useAppTheme();
  const { signedIn } = useAuth();
  const { width: winWidth } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>("daily");
  const [endlessLen, setEndlessLen] = useState<number>(5);
  const [secret, setSecret] = useState<string>("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [evaluations, setEvaluations] = useState<
    ReturnType<typeof evaluateGuess>[]
  >([]);
  const [current, setCurrent] = useState<string>("");
  const [done, setDone] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [keyStates, setKeyStates] = useState<
    Record<string, "correct" | "present" | "absent">
  >({});
  const inputRef = useRef<TextInput | null>(null);
  const [boardLayout, setBoardLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [boardContentLayout, setBoardContentLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const overlayW = 280;
  const gap = 16;
  const margin = 12;

  useEffect(() => {
    (async () => {
      const words =
        mode === "daily"
          ? getWordsForLength(DAILY_WORD_LEN)
          : getWordsForLength(endlessLen);
      const word =
        mode === "daily"
          ? await getDailyWord(words, BASE_DATE)
          : randomWord(words);
      setSecret(word);
      resetGameState();
    })();
  }, [mode, endlessLen]);

  useEffect(() => {
    const handler = (e: any) => {
      const key = e.key;
      if (/^[a-zA-Z]$/.test(key)) onKey(key.toUpperCase());
      else if (key === "Enter") onKey("ENTER");
      else if (key === "Backspace") onKey("DEL");
    };
    if (Platform.OS === "web") {
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, [current, guesses, done, secret]);

  // Focus hidden input on native to catch hardware Enter
  useEffect(() => {
    if (Platform.OS !== "web") {
      inputRef.current?.focus?.();
    }
  }, []);

  function resetGameState() {
    setGuesses([]);
    setEvaluations([]);
    setCurrent("");
    setDone(false);
    setMessage("");
    setKeyStates({});
  }

  function currentLen() {
    return mode === "daily" ? DAILY_WORD_LEN : endlessLen;
  }

  function onKey(key: string) {
    if (done) return;
    if (key === "ENTER") return submitGuess();
    if (key === "DEL") return setCurrent((s) => s.slice(0, -1));
    if (/^[A-Z]$/.test(key)) {
      setCurrent((s) => (s.length < currentLen() ? s + key.toLowerCase() : s));
    }
  }

  function submitGuess() {
    const len = currentLen();
    const allowed = getAllowedGuessesSet(len);
    if (current.length !== len) return setMessage("Not enough letters");
    if (!allowed.has(current)) return setMessage("Not in word list");
    const evalRow = evaluateGuess(secret, current);
    setGuesses((g) => [...g, current]);
    setEvaluations((e) => [...e, evalRow]);
    setCurrent("");
    setMessage("");

    setKeyStates((ks) => {
      const next = { ...ks };
      for (let i = 0; i < len; i++) {
        const ch = current[i];
        const prev = next[ch];
        const now = evalRow[i];
        if (
          now === "correct" ||
          (prev !== "correct" && now === "present") ||
          (!prev && now === "absent")
        ) {
          next[ch] = now;
        }
      }
      return next;
    });

    if (current === secret) {
      setDone(true);
      setMessage(mode === "daily" ? "You solved today's puzzle!" : "Nice!");
      // Record the win via serverless API (authenticated by HttpOnly cookies)
      const guessCount = guesses.length + 1;
      fetch("/api/wordle/win", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ guessCount }),
      }).catch(() => {});
    } else if (guesses.length + 1 >= MAX_ROWS) {
      setDone(true);
      setMessage(`Out of tries. The word was ${secret.toUpperCase()}`);
      // Record a loss
      fetch("/api/wordle/loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }).catch(() => {});
    }
  }

  const [stats, setStats] = useState<{
    games_played: number;
    wordles_completed: number;
    winRate: number;
    distribution: Record<string, number>;
  } | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);

  useEffect(() => {
    if (done) {
      fetch("/api/wordle/stats", {
        method: "GET",
        credentials: "include",
      })
        .then((r) => r.json())
        .then((data) => {
          setStats(data);
          if (Platform.OS !== "web") setShowStatsModal(true);
        })
        .catch(() => {});
    }
  }, [done]);

  function startEndless() {
    setMode("endless");
  }

  function newEndlessGame() {
    const words = getWordsForLength(endlessLen);
    setSecret(randomWord(words));
    resetGameState();
  }

  // Compute web overlay element safely (avoid inline IIFEs in JSX)
  const statsOverlayEl = (() => {
    if (Platform.OS !== "web" || !stats || !boardContentLayout) return null;
    const boardLeft = boardContentLayout.x;
    const boardCenterY = boardContentLayout.y + boardContentLayout.height / 2;
    const canPlaceLeft = boardLeft - gap - overlayW >= margin;
    if (!canPlaceLeft) return null; // fall back to inline stats
    const midpointLeft = boardLeft / 2 - overlayW / 2; // halfway between edge (0) and boardLeft
    const clampedLeft = Math.min(
      boardLeft - overlayW - gap,
      Math.max(margin, midpointLeft),
    );
    const top = boardCenterY - 70;
    return (
      <View style={[styles.statsOverlay, { left: clampedLeft, top }]}> 
        <StatsChart stats={stats} />
      </View>
    );
  })();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Wordle (Daily + Endless)
        </Text>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode("daily")}
            style={[
              styles.modeBtn,
              { backgroundColor: colors.icon },
              mode === "daily" && { backgroundColor: colors.tint },
            ]}
          >
            <Text
              style={[
                styles.modeText,
                {
                  color: readableTextOn(
                    mode === "daily" ? colors.tint : colors.icon,
                  ),
                },
              ]}
            >
              Daily
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("endless")}
            style={[
              styles.modeBtn,
              { backgroundColor: colors.icon },
              mode === "endless" && { backgroundColor: colors.tint },
            ]}
          >
            <Text
              style={[
                styles.modeText,
                {
                  color: readableTextOn(
                    mode === "endless" ? colors.tint : colors.icon,
                  ),
                },
              ]}
            >
              Endless
            </Text>
          </Pressable>
        </View>
        {mode === "endless" && (
          <View style={styles.lenRow}>
            {[4, 5, 6].map((len) => (
              <Pressable
                key={len}
                onPress={() => setEndlessLen(len)}
                style={[
                  styles.lenBtn,
                  { backgroundColor: colors.icon },
                  endlessLen === len && { backgroundColor: colors.tint },
                ]}
              >
                <Text
                  style={[
                    styles.modeText,
                    {
                      color: readableTextOn(
                        endlessLen === len ? colors.tint : colors.icon,
                      ),
                    },
                  ]}
                >
                  {len} Letters
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View
        style={styles.boardWrap}
        onLayout={({ nativeEvent }) => {
          const { x, y, width, height } = nativeEvent.layout || ({} as any);
          if (width && height) setBoardLayout({ x: x || 0, y: y || 0, width, height });
        }}
      >
        <View
          onLayout={({ nativeEvent }) => {
            const { x, y, width, height } = nativeEvent.layout || ({} as any);
            if (width && height) setBoardContentLayout({ x: x || 0, y: y || 0, width, height });
          }}
        >
          <Board
            guesses={guesses}
            evaluations={evaluations}
            currentGuess={current}
            cols={currentLen()}
          />
        </View>
      </View>

      {!!message && (
        <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      )}

      {!done ? (
        <Keyboard onKey={onKey} keyStates={keyStates} />
      ) : (
        <View style={{ gap: 8 }}>
          {mode === "daily" ? (
            <Pressable
              onPress={startEndless}
              style={[styles.cta, { backgroundColor: colors.tint }]}
            >
              <Text
                style={[styles.ctaText, { color: readableTextOn(colors.tint) }]}
              >
                Play Endless Mode
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={newEndlessGame}
              style={[styles.cta, { backgroundColor: colors.tint }]}
            >
              <Text
                style={[styles.ctaText, { color: readableTextOn(colors.tint) }]}
              >
                New Endless Game
              </Text>
            </Pressable>
          )}
          {/* On native, show stats in a modal */}
        </View>
      )}

      {Platform.OS !== "web" && (
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={current}
          onChangeText={() => {}}
          onSubmitEditing={() => onKey("ENTER")}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === "Enter") onKey("ENTER");
            else if (nativeEvent.key === "Backspace") onKey("DEL");
          }}
          blurOnSubmit={false}
        />
      )}

      {/* Mobile Stats Modal */}
      {Platform.OS !== "web" && stats && (
        <Modal
          visible={showStatsModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStatsModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.background }]}> 
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.title, { color: colors.text }]}>Stats</Text>
                <Pressable
                  onPress={() => setShowStatsModal(false)}
                  style={[styles.cta, { backgroundColor: colors.tint }]}
                >
                  <Text style={[styles.ctaText, { color: readableTextOn(colors.tint) }]}>Close</Text>
                </Pressable>
              </View>
              <View style={{ marginTop: 12 }}>
                <StatsChart stats={stats} />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {statsOverlayEl}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  header: { alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "800" },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeText: { fontWeight: "700" },
  lenRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  lenBtn: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  boardWrap: { alignItems: "center" },
  message: { textAlign: "center" },
  cta: {
    borderRadius: 6,
    padding: 12,
    alignItems: "center",
  },
  ctaText: { fontWeight: "700" },
  hiddenInput: { height: 0, width: 0 },
  statsOverlay: {
    position: "absolute",
    width: 280,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "90%",
    maxWidth: 420,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
});
