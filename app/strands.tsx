import GoogleSignInLink from "@/components/GoogleSignInLink";
import { useAuth } from "@/hooks/use-auth";
import { useAppTheme } from "@/lib/theme/context";
import { readableTextOn } from "@/lib/theme/theme";
import {
  fetchStrandsPuzzle,
  getNYTStrandsDateString,
  submitStrandsWord,
} from "@/lib/strands/api";
import type { StrandsPuzzle } from "@/lib/strands/types";
import {
  getPendingStrandsProgress,
  queuePendingStrandsEvent,
  queuePendingStrandsProgress,
} from "@/lib/strands/pending";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Line } from "react-native-svg";

type Coords = { r: number; c: number };

type FoundPath = {
  kind: "theme" | "spangram";
  word: string;
  coords: Coords[];
};

type StrandsStats = {
  games_played: number;
  strands_completed: number;
  winRate: number;
};

function keyFor(r: number, c: number) {
  return `${r},${c}`;
}

function isAdjacent(a: Coords, b: Coords) {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return (dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0));
}

export default function StrandsPage() {
  const { colors } = useAppTheme();
  const { signedIn } = useAuth();

  const [date, setDate] = useState<string>("");
  const [puzzle, setPuzzle] = useState<StrandsPuzzle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [selected, setSelected] = useState<Coords[]>([]);
  const selectedRef = useRef<Coords[]>([]);
  const [foundThemeWords, setFoundThemeWords] = useState<string[]>([]);
  const [foundSpangram, setFoundSpangram] = useState<boolean>(false);
  const [foundPaths, setFoundPaths] = useState<FoundPath[]>([]);
  const [gaveUp, setGaveUp] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const [progressLoaded, setProgressLoaded] = useState(false);
  const resultRecordedRef = useRef(false);

  const [stats, setStats] = useState<StrandsStats | null>(null);

  useEffect(() => {
    // Only compute date on client to avoid SSR/hydration mismatch.
    setDate(getNYTStrandsDateString());
  }, []);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setMessage("");
    setPuzzle(null);
    setSelected([]);
    setFoundThemeWords([]);
    setFoundSpangram(false);
    setFoundPaths([]);
    setGaveUp(false);
    setStats(null);
    setProgressLoaded(false);
    resultRecordedRef.current = false;

    (async () => {
      try {
        const p = await fetchStrandsPuzzle(date);
        if (cancelled) return;
        setPuzzle(p);
      } catch (e: any) {
        if (cancelled) return;
        setError(typeof e?.message === "string" ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => {
    if (!puzzle || !date) return;
    let cancelled = false;

    const apply = (input: {
      foundThemeWords: string[];
      foundSpangram: boolean;
      foundPaths?: unknown;
      gaveUp: boolean;
    }) => {
      const normTheme = Array.from(
        new Set(
          (input.foundThemeWords || [])
            .filter((w) => typeof w === "string")
            .map((w) => w.trim().toUpperCase())
            .filter((w) => /^[A-Z]{2,}$/.test(w)),
        ),
      ).sort();
      setFoundThemeWords(normTheme);
      setFoundSpangram(Boolean(input.foundSpangram));

      const normalizeFoundPaths = (v: unknown): FoundPath[] => {
        if (!Array.isArray(v)) return [];
        const out: FoundPath[] = [];
        for (const item of v) {
          if (!item || typeof item !== "object") continue;
          const kind = (item as any).kind;
          const word =
            typeof (item as any).word === "string"
              ? (item as any).word.trim().toUpperCase()
              : "";
          const coordsRaw = (item as any).coords;
          if (kind !== "theme" && kind !== "spangram") continue;
          if (!/^[A-Z]{2,}$/.test(word)) continue;
          if (!Array.isArray(coordsRaw) || coordsRaw.length < 2) continue;
          const coords: Coords[] = [];
          let ok = true;
          for (const c of coordsRaw) {
            const r = Number((c as any)?.r);
            const cc = Number((c as any)?.c);
            if (!Number.isFinite(r) || !Number.isInteger(r) || r < 0 || r > 50) {
              ok = false;
              break;
            }
            if (
              !Number.isFinite(cc) ||
              !Number.isInteger(cc) ||
              cc < 0 ||
              cc > 50
            ) {
              ok = false;
              break;
            }
            coords.push({ r, c: cc });
          }
          if (!ok) continue;
          out.push({ kind, word, coords });
        }

        // De-dupe by kind+word, keep first.
        const seen = new Set<string>();
        const dedup: FoundPath[] = [];
        for (const p of out) {
          const k = `${p.kind}:${p.word}`;
          if (seen.has(k)) continue;
          seen.add(k);
          dedup.push(p);
        }
        return dedup;
      };

      setFoundPaths(normalizeFoundPaths(input.foundPaths));
      setGaveUp(Boolean(input.gaveUp));
    };

    (async () => {
      try {
        if (signedIn) {
          const resp = await fetch(`/api/strands/progress?date=${date}`, {
            method: "GET",
            credentials: "include",
          });
          if (resp.ok) {
            const data = (await resp.json()) as any;
            const ftw = Array.isArray(data?.foundThemeWords)
              ? data.foundThemeWords
              : [];
            const foundSpangram = Boolean(data?.foundSpangram);
            const foundPaths = data?.foundPaths;
            const gaveUp = Boolean(data?.gaveUp);
            apply({ foundThemeWords: ftw, foundSpangram, foundPaths, gaveUp });
          }
        } else if (signedIn === false) {
          const local = getPendingStrandsProgress(date);
          if (local) {
            apply({
              foundThemeWords: local.foundThemeWords,
              foundSpangram: local.foundSpangram,
              foundPaths: local.foundPaths,
              gaveUp: local.gaveUp,
            });
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setProgressLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [puzzle, date, signedIn]);

  const selectedKeySet = useMemo(() => {
    const s = new Set<string>();
    for (const p of selected) s.add(keyFor(p.r, p.c));
    return s;
  }, [selected]);

  const foundThemeCellSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of foundPaths) {
      if (p.kind !== "theme") continue;
      for (const c of p.coords) s.add(keyFor(c.r, c.c));
    }
    return s;
  }, [foundPaths]);

  const foundSpangramCellSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of foundPaths) {
      if (p.kind !== "spangram") continue;
      for (const c of p.coords) s.add(keyFor(c.r, c.c));
    }
    return s;
  }, [foundPaths]);

  const foundAnyCellSet = useMemo(() => {
    const s = new Set<string>();
    for (const k of foundThemeCellSet) s.add(k);
    for (const k of foundSpangramCellSet) s.add(k);
    return s;
  }, [foundThemeCellSet, foundSpangramCellSet]);

  const selectedWord = useMemo(() => {
    if (!puzzle) return "";
    return selected
      .map(({ r, c }) => puzzle.startingBoard[r]?.[c] ?? "")
      .join("")
      .toUpperCase();
  }, [selected, puzzle]);

  const isComplete = useMemo(() => {
    if (!puzzle) return false;
    if (gaveUp) return false;
    if (!Number.isFinite(puzzle.themeWordCount) || puzzle.themeWordCount <= 0)
      return false;
    return foundSpangram && foundThemeWords.length >= puzzle.themeWordCount;
  }, [puzzle, gaveUp, foundSpangram, foundThemeWords]);

  const isDone = gaveUp || isComplete;

  // Persist progress (signed-in => server, signed-out => local queue)
  useEffect(() => {
    if (!date) return;
    if (!progressLoaded) return;

    if (signedIn) {
      fetch("/api/strands/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date,
          foundThemeWords,
          foundSpangram,
          foundPaths,
          gaveUp,
        }),
      }).catch(() => {});
    } else if (signedIn === false) {
      queuePendingStrandsProgress({
        date,
        foundThemeWords,
        foundSpangram,
        foundPaths,
        gaveUp,
      });
    }
  }, [
    signedIn,
    date,
    foundThemeWords,
    foundSpangram,
    foundPaths,
    gaveUp,
    progressLoaded,
  ]);

  // Record final result (win/loss) once
  useEffect(() => {
    if (!date) return;
    if (!progressLoaded) return;
    if (!isDone) return;
    if (resultRecordedRef.current) return;

    resultRecordedRef.current = true;

    (async () => {
      try {
        if (signedIn) {
          if (isComplete) {
            await fetch("/api/strands/win", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ date }),
            });
          } else {
            await fetch("/api/strands/loss", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ date }),
            });
          }

          const statsResp = await fetch("/api/strands/stats", {
            method: "GET",
            credentials: "include",
          });
          if (statsResp.ok) {
            const data = (await statsResp.json()) as any;
            setStats({
              games_played: Number(data?.games_played || 0),
              strands_completed: Number(data?.strands_completed || 0),
              winRate: Number(data?.winRate || 0),
            });
          }
        } else if (signedIn === false) {
          queuePendingStrandsEvent({
            type: isComplete ? "win" : "loss",
            date,
            createdAt: Date.now(),
          });
        }
      } catch {
        // ignore
      }
    })();
  }, [isDone, isComplete, signedIn, date, progressLoaded]);

  function toggleCell(r: number, c: number) {
    if (!puzzle) return;
    if (isDone) return;
    if (foundAnyCellSet.has(keyFor(r, c))) return;

    setMessage("");

    setSelected((prev) => {
      const k = keyFor(r, c);

      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (last.r === r && last.c === c) {
          return prev.slice(0, -1);
        }
      }

      if (prev.some((p) => keyFor(p.r, p.c) === k)) return prev;

      if (prev.length === 0) return [...prev, { r, c }];

      const last = prev[prev.length - 1];
      if (!isAdjacent(last, { r, c })) return prev;

      return [...prev, { r, c }];
    });
  }

  function clearSelection() {
    setSelected([]);
    selectedRef.current = [];
  }

  function backspaceSelection() {
    setSelected((prev) => {
      const next = prev.slice(0, -1);
      selectedRef.current = next;
      return next;
    });
  }

  function computeWordFrom(coords: Coords[]) {
    if (!puzzle) return "";
    return coords
      .map(({ r, c }) => puzzle.startingBoard[r]?.[c] ?? "")
      .join("")
      .toUpperCase();
  }

  async function onSubmit(coordsOverride?: Coords[]) {
    if (!puzzle) return;
    if (isDone) return;
    const coords = coordsOverride ?? selectedRef.current;
    const word = computeWordFrom(coords);
    if (!/^[A-Z]{2,}$/.test(word)) {
      setMessage("Select at least 2 letters");
      return;
    }

    try {
      const result = await submitStrandsWord({ date, word });
      if (result.kind === "spangram") {
        setFoundSpangram(true);
        setFoundPaths((prev) => {
          if (prev.some((p) => p.kind === "spangram")) return prev;
          return [...prev, { kind: "spangram", word: result.word, coords }];
        });
        setMessage(`Spangram found: ${result.word}`);
      } else if (result.kind === "theme") {
        setFoundThemeWords((prev) => {
          if (prev.includes(result.word)) return prev;
          return [...prev, result.word].sort();
        });
        setFoundPaths((prev) => {
          const key = `theme:${result.word}`;
          if (prev.some((p) => `${p.kind}:${p.word}` === key)) return prev;
          return [...prev, { kind: "theme", word: result.word, coords }];
        });
        setMessage(`Theme word found: ${result.word}`);
      } else {
        setMessage("Not a theme word");
      }
    } catch {
      setMessage("Could not check that word. Try again.");
    } finally {
      clearSelection();
    }
  }

  function onGiveUp() {
    if (isDone) return;
    setGaveUp(true);
    setMessage("Gave up.");
  }

  const boardSize = useMemo(() => {
    if (!puzzle) return 0;
    // Keep cell sizes readable; Strands is typically 8x6.
    const maxCell = 52;
    const minCell = 36;
    const cell = Math.max(
      minCell,
      Math.min(maxCell, Math.floor(360 / Math.max(1, puzzle.cols))),
    );
    return cell;
  }, [puzzle]);

  const cellGap = 6;

  const pickCellFromPoint = (x: number, y: number): Coords | null => {
    if (!puzzle) return null;
    if (!boardSize) return null;
    const pitch = boardSize + cellGap;
    const r = Math.floor(y / pitch);
    const c = Math.floor(x / pitch);
    if (r < 0 || c < 0 || r >= puzzle.rows || c >= puzzle.cols) return null;

    // Ignore touches in the gap area.
    const insideX = x - c * pitch;
    const insideY = y - r * pitch;
    if (insideX < 0 || insideY < 0 || insideX > boardSize || insideY > boardSize)
      return null;

    return { r, c };
  };

  const panResponder = useMemo(() => {
    const handlePoint = (evt: any) => {
      if (!puzzle) return;
      if (isDone) return;
      const x = Number(evt?.nativeEvent?.locationX);
      const y = Number(evt?.nativeEvent?.locationY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const cell = pickCellFromPoint(x, y);
      if (!cell) return;
      if (foundAnyCellSet.has(keyFor(cell.r, cell.c))) return;

      setSelected((prev) => {
        const k = keyFor(cell.r, cell.c);
        if (prev.length === 0) return [cell];

        const last = prev[prev.length - 1];
        if (last.r === cell.r && last.c === cell.c) return prev;

        // Allow dragging back one step to undo.
        if (prev.length >= 2) {
          const prev2 = prev[prev.length - 2];
          if (prev2.r === cell.r && prev2.c === cell.c) return prev.slice(0, -1);
        }

        // Do not revisit a cell in the same path.
        if (prev.some((p) => keyFor(p.r, p.c) === k)) return prev;

        if (!isAdjacent(last, cell)) return prev;
        return [...prev, cell];
      });
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => !isDone,
      onMoveShouldSetPanResponder: () => !isDone,
      onPanResponderGrant: (evt) => {
        setMessage("");
        handlePoint(evt);
      },
      onPanResponderMove: (evt) => {
        handlePoint(evt);
      },
      onPanResponderRelease: () => {
        // NYT-like: lift to submit
        const coords = selectedRef.current;
        if (coords.length >= 2) {
          onSubmit(coords).catch(() => {});
        }
      },
      onPanResponderTerminate: () => {
        // no-op
      },
    });
  }, [isDone, puzzle, boardSize, foundAnyCellSet]);

  // Keep an always-fresh ref for panResponder release to avoid state timing issues.
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const selectionPoints = useMemo(() => {
    if (!puzzle) return [] as Array<{ x: number; y: number }>;
    const pitch = boardSize + cellGap;
    const radius = boardSize / 2;
    return selected.map(({ r, c }) => ({
      x: c * pitch + radius,
      y: r * pitch + radius,
    }));
  }, [selected, puzzle, boardSize]);

  const foundPathLines = useMemo(() => {
    if (!puzzle) return [] as Array<{ pts: Array<{ x: number; y: number }>; color: string }>;
    const pitch = boardSize + cellGap;
    const radius = boardSize / 2;

    const themeFoundBg = "#2e7d32";
    const spangramFoundBg = "#f9a825";

    const out: Array<{ pts: Array<{ x: number; y: number }>; color: string }> = [];
    for (const p of foundPaths) {
      if (!p?.coords?.length || p.coords.length < 2) continue;
      const pts: Array<{ x: number; y: number }> = [];
      let ok = true;
      for (const c of p.coords) {
        if (!Number.isFinite(c?.r) || !Number.isFinite(c?.c)) {
          ok = false;
          break;
        }
        if (c.r < 0 || c.c < 0 || c.r >= puzzle.rows || c.c >= puzzle.cols) {
          ok = false;
          break;
        }
        pts.push({ x: c.c * pitch + radius, y: c.r * pitch + radius });
      }
      if (!ok || pts.length < 2) continue;
      out.push({
        pts,
        color: p.kind === "spangram" ? spangramFoundBg : themeFoundBg,
      });
    }
    return out;
  }, [foundPaths, puzzle, boardSize]);

  const boardPixelSize = useMemo(() => {
    if (!puzzle) return { w: 0, h: 0 };
    const pitch = boardSize + cellGap;
    const w = puzzle.cols > 0 ? puzzle.cols * boardSize + (puzzle.cols - 1) * cellGap : 0;
    const h = puzzle.rows > 0 ? puzzle.rows * boardSize + (puzzle.rows - 1) * cellGap : 0;
    // 'w/h' align to the Pressable grid because rows use gap=cellGap.
    return { w, h };
  }, [puzzle, boardSize]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Strands</Text>
        {!!date && (
          <Text style={[styles.meta, { color: colors.text }]}>{date}</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tint} />
          <Text style={{ color: colors.text }}>Loading puzzle…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.text, textAlign: "center" }}>{error}</Text>
          <Text style={{ color: colors.text, textAlign: "center" }}>
            Try reloading.
          </Text>
        </View>
      ) : !puzzle ? (
        <View style={styles.center}>
          <Text style={{ color: colors.text }}>No puzzle.</Text>
        </View>
      ) : (
        <>
          <View style={styles.clueWrap}>
            <Text style={[styles.clue, { color: colors.text }]}>
              {puzzle.clue}
            </Text>
            <Text style={[styles.progress, { color: colors.text }]}>
              Theme words: {foundThemeWords.length}/{puzzle.themeWordCount} •
              Spangram: {foundSpangram ? "yes" : "no"}
            </Text>
          </View>

          <View style={styles.boardWrap} {...panResponder.panHandlers}>
            {(foundPathLines.length > 0 || selectionPoints.length >= 2) && (
              <View
                pointerEvents="none"
                style={[
                  styles.pathOverlay,
                  { width: boardPixelSize.w, height: boardPixelSize.h },
                ]}
              >
                <Svg width={boardPixelSize.w} height={boardPixelSize.h}>
                  {foundPathLines.map((path, pi) =>
                    path.pts.slice(0, -1).map((p, i) => {
                      const q = path.pts[i + 1];
                      return (
                        <Line
                          key={`f-${pi}-${i}`}
                          x1={p.x}
                          y1={p.y}
                          x2={q.x}
                          y2={q.y}
                          stroke={path.color}
                          strokeWidth={12}
                          strokeLinecap="round"
                          opacity={0.55}
                        />
                      );
                    }),
                  )}

                  {selectionPoints.slice(0, -1).map((p, i) => {
                    const q = selectionPoints[i + 1];
                    return (
                      <Line
                        key={`s-${i}`}
                        x1={p.x}
                        y1={p.y}
                        x2={q.x}
                        y2={q.y}
                        stroke={colors.tint}
                        strokeWidth={14}
                        strokeLinecap="round"
                        opacity={0.5}
                      />
                    );
                  })}
                </Svg>
              </View>
            )}

            {puzzle.startingBoard.map((row, r) => (
              <View key={r} style={styles.row}>
                {row.split("").map((ch, c) => {
                  const selectedHere = selectedKeySet.has(keyFor(r, c));

                  const isSpangramFound = foundSpangramCellSet.has(keyFor(r, c));
                  const isThemeFound = foundThemeCellSet.has(keyFor(r, c));

                  const themeFoundBg = "#2e7d32";
                  const spangramFoundBg = "#f9a825";

                  const bg = selectedHere
                    ? colors.tint
                    : isSpangramFound
                      ? spangramFoundBg
                      : isThemeFound
                        ? themeFoundBg
                        : "rgba(0,0,0,0.08)";

                  const fg = selectedHere
                    ? readableTextOn(colors.tint)
                    : isSpangramFound
                      ? readableTextOn(spangramFoundBg)
                      : isThemeFound
                        ? readableTextOn(themeFoundBg)
                        : colors.text;

                  const disabled = isDone || foundAnyCellSet.has(keyFor(r, c));
                  return (
                    <Pressable
                      key={c}
                      onPress={() => toggleCell(r, c)}
                      disabled={disabled}
                      style={[
                        styles.cell,
                        {
                          width: boardSize,
                          height: boardSize,
                          borderRadius: Math.floor(boardSize / 2),
                          backgroundColor: bg,
                          borderColor: "rgba(0,0,0,0.18)",
                        },
                      ]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.cellText, { color: fg }]}>{ch}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {!!message && (
            <Text style={[styles.message, { color: colors.text }]}>
              {message}
            </Text>
          )}

          <View style={styles.selectionWrap}>
            <Text style={[styles.selection, { color: colors.text }]}>
              {selectedWord || "(select letters)"}
            </Text>
          </View>

          {(foundThemeWords.length > 0 || foundSpangram) && (
            <View style={{ gap: 8, alignItems: "center" }}>
              {foundSpangram && (
                <Text style={{ color: "#f9a825", fontWeight: "800" }}>
                  Spangram found
                </Text>
              )}
              {foundThemeWords.length > 0 && (
                <Text style={{ color: "#2e7d32", fontWeight: "800" }}>
                  Found: {foundThemeWords.join(", ")}
                </Text>
              )}
            </View>
          )}

          {!isDone ? (
            <View style={styles.controls}>
              <Pressable
                onPress={backspaceSelection}
                style={[styles.btn, { backgroundColor: colors.icon }]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.btnText,
                    { color: readableTextOn(colors.icon) },
                  ]}
                >
                  Back
                </Text>
              </Pressable>
              <Pressable
                onPress={clearSelection}
                style={[styles.btn, { backgroundColor: colors.icon }]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.btnText,
                    { color: readableTextOn(colors.icon) },
                  ]}
                >
                  Clear
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onSubmit()}
                style={[styles.btn, { backgroundColor: colors.tint }]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.btnText,
                    { color: readableTextOn(colors.tint) },
                  ]}
                >
                  Submit
                </Text>
              </Pressable>
              <Pressable
                onPress={onGiveUp}
                style={[styles.btn, { backgroundColor: "#b00020" }]}
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>Give up</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10, alignItems: "center" }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {isComplete ? "You solved it!" : "Game over"}
              </Text>

              {signedIn === false && (
                <View style={{ gap: 10, alignItems: "center" }}>
                  <Text style={{ color: colors.text, textAlign: "center" }}>
                    Please sign in to save stats.
                  </Text>
                  <GoogleSignInLink />
                </View>
              )}

              {signedIn && stats && (
                <View style={{ gap: 4, alignItems: "center" }}>
                  <Text style={{ color: colors.text }}>
                    Games played: {stats.games_played}
                  </Text>
                  <Text style={{ color: colors.text }}>
                    Completed: {stats.strands_completed}
                  </Text>
                  <Text style={{ color: colors.text }}>
                    Win rate: {stats.winRate}%
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  header: { alignItems: "center", gap: 4 },
  title: { fontSize: 20, fontWeight: "800" },
  meta: { fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  clueWrap: { alignItems: "center", gap: 6 },
  clue: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  progress: { fontSize: 13 },
  boardWrap: { alignSelf: "center", gap: 6, position: "relative" },
  pathOverlay: { position: "absolute", left: 0, top: 0 },
  row: { flexDirection: "row", gap: 6, justifyContent: "center" },
  cell: {
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontSize: 18, fontWeight: "800" },
  message: { textAlign: "center" },
  selectionWrap: { alignItems: "center" },
  selection: { fontSize: 16, fontWeight: "700" },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  btn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  btnText: { fontWeight: "800" },
});
