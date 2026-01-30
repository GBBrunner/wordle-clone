"use client";
import {
  fetchConnectionsPuzzle,
  getNYTConnectionsDateString,
} from "@/lib/connections/api";
import type {
  ConnectionsCategory,
  ConnectionsPuzzle,
} from "@/lib/connections/types";
import { useAuth } from "@/hooks/use-auth";
import { useAppTheme } from "@/lib/theme/context";
import { readableTextOn } from "@/lib/theme/theme";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { FiArrowLeft } from "react-icons/fi";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import StatsChart from "../components/StatsChart";
function stringifyError(value: any, fallback = "") {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (!value) return fallback;
  if (typeof value === "object") {
    // Prefer Error.message when available
    if ("message" in value && typeof (value as any).message === "string") {
      return (value as any).message;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

type ConnectionsProgress = {
  mistakesLeft: number;
  solvedCategoryIndexes: number[];
};

type ConnectionsStats = {
  games_played: number;
  connections_completed: number;
  winRate: number;
  distribution: Record<string, number>;
};

const CONNECTIONS_PROGRESS_KEY_PREFIX = "connections_progress_";
const CONNECTIONS_STATS_KEY = "connections_stats";

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isBrowserStorageAvailable() {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function getLocalProgressKey(d: string) {
  return `${CONNECTIONS_PROGRESS_KEY_PREFIX}${d}`;
}

function loadLocalProgress(d: string): ConnectionsProgress | null {
  if (!isBrowserStorageAvailable()) return null;
  const parsed = safeParseJSON<any>(window.localStorage.getItem(getLocalProgressKey(d)));
  const mistakesLeft = Number(parsed?.mistakesLeft);
  const solvedCategoryIndexes = parsed?.solvedCategoryIndexes;
  if (!Number.isFinite(mistakesLeft) || mistakesLeft < 0 || mistakesLeft > 4)
    return null;
  if (
    !Array.isArray(solvedCategoryIndexes) ||
    !solvedCategoryIndexes.every(
      (x: any) => Number.isInteger(x) && Number.isFinite(x) && x >= 0 && x <= 3,
    )
  ) {
    return null;
  }
  return {
    mistakesLeft,
    solvedCategoryIndexes: Array.from(new Set(solvedCategoryIndexes)).sort(
      (a, b) => a - b,
    ),
  };
}

function saveLocalProgress(d: string, progress: ConnectionsProgress) {
  if (!isBrowserStorageAvailable()) return;
  try {
    window.localStorage.setItem(getLocalProgressKey(d), JSON.stringify(progress));
  } catch {
    // ignore
  }
}

function loadLocalStats(): ConnectionsStats {
  const base: ConnectionsStats = {
    games_played: 0,
    connections_completed: 0,
    winRate: 0,
    distribution: {
      connections_in_0: 0,
      connections_in_1: 0,
      connections_in_2: 0,
      connections_in_3: 0,
      connections_in_4: 0,
    },
  };
  if (!isBrowserStorageAvailable()) return base;
  const parsed = safeParseJSON<any>(window.localStorage.getItem(CONNECTIONS_STATS_KEY));
  const games_played = Number(parsed?.games_played || 0);
  const connections_completed = Number(parsed?.connections_completed || 0);
  const distribution: Record<string, number> = { ...base.distribution };
  for (let i = 0; i <= 4; i++) {
    const k = `connections_in_${i}`;
    const v = Number(parsed?.distribution?.[k] ?? parsed?.[k] ?? 0);
    distribution[k] = Number.isFinite(v) ? v : 0;
  }
  const winRate =
    games_played > 0
      ? Math.round((connections_completed / games_played) * 100)
      : 0;
  return {
    games_played: Number.isFinite(games_played) ? games_played : 0,
    connections_completed: Number.isFinite(connections_completed)
      ? connections_completed
      : 0,
    winRate,
    distribution,
  };
}

function saveLocalStats(s: ConnectionsStats) {
  if (!isBrowserStorageAvailable()) return;
  try {
    window.localStorage.setItem(CONNECTIONS_STATS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

type Tile = {
  content: string;
  position: number;
  categoryIndex: number;
};

type SolvedGroup = {
  title: string;
  tiles: Tile[];
  color: string;
  categoryIndex: number;
};

const GROUP_COLORS = [
  "#f5d76e", // yellow
  "#a8d08d", // green
  "#9dc3e6", // blue
  "#c9a0dc", // purple
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeCategoryTitle(title: string) {
  return title.replace(/\s+/g, " ").trim();
}

function buildTiles(categories: ConnectionsCategory[]): Tile[] {
  const tiles: Tile[] = [];
  categories.forEach((cat, categoryIndex) => {
    cat.cards.forEach((card) => {
      tiles.push({
        content: card.content,
        position: card.position,
        categoryIndex,
      });
    });
  });

  // NYT includes a `position` so we can start in the official layout.
  return tiles.sort((a, b) => a.position - b.position);
}

export default function ConnectionsPage() {
  const { colors, colorScheme } = useAppTheme();
  const { signedIn } = useAuth();
  const CONNECTIONS_TILE_LIGHT_BG = "#e6dfe6";
  const CONNECTIONS_TILE_LIGHT_SELECTED = "#95b9ca";
  const { width } = useWindowDimensions();
  const router = useRouter();
  // Use a stable default width for SSR, then actual width on client
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const stableWidth = mounted ? width : 400; // Default width for SSR
  const containerPadding = 16; // 8 * 2
  const availableWidth = stableWidth - containerPadding;
  const gridWidth = availableWidth * 0.5;
  const gap = 5;
  const numColumns = 4;
  const tileWidth = (gridWidth - gap * (numColumns - 1)) / numColumns;
  const [puzzle, setPuzzle] = useState<ConnectionsPuzzle | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [solved, setSolved] = useState<SolvedGroup[]>([]);
  const [mistakesLeft, setMistakesLeft] = useState<number>(4);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const [progressLoaded, setProgressLoaded] = useState(false);
  const resultRecordedRef = React.useRef(false);
  const [stats, setStats] = useState<ConnectionsStats | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Only calculate date on the client to avoid SSR/hydration mismatch
  const [date, setDate] = useState<string>("");
  useEffect(() => {
    setDate(getNYTConnectionsDateString());
  }, []);

  useEffect(() => {
    // Don't fetch until date is set (client-side only)
    if (!date) return;
    setProgressLoaded(false);
    resultRecordedRef.current = false;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const data = await fetchConnectionsPuzzle(date);
        if (cancelled) return;
        setPuzzle(data);
        setTiles(buildTiles(data.categories));
        setSelected(new Set());
        setSolved([]);
        setMistakesLeft(4);
        setStats(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(stringifyError(e, "Failed to load puzzle"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  // Restore progress once we have the puzzle and auth state.
  useEffect(() => {
    if (!puzzle || !date) return;
    if (signedIn === null) return;

    let cancelled = false;
    (async () => {
      try {
        const apply = (progress: ConnectionsProgress) => {
          if (cancelled) return;
          const solvedUnique = Array.from(
            new Set(progress.solvedCategoryIndexes),
          ).sort((a, b) => a - b);

          setMistakesLeft(progress.mistakesLeft);
          setSelected(new Set());
          setSolved(
            solvedUnique.map((categoryIndex) => {
              const title = normalizeCategoryTitle(
                puzzle.categories[categoryIndex]?.title ?? "",
              );
              const color = GROUP_COLORS[categoryIndex] ?? colors.tint;
              const groupTiles = buildTiles(puzzle.categories).filter(
                (t) => t.categoryIndex === categoryIndex,
              );
              return {
                title,
                tiles: groupTiles,
                color,
                categoryIndex,
              };
            }),
          );
        };

        if (signedIn) {
          const resp = await fetch(`/api/connections/progress?date=${date}`, {
            method: "GET",
            credentials: "include",
          });
          if (!resp.ok) {
            setProgressLoaded(true);
            return;
          }
          const data = (await resp.json()) as any;
          const mistakesLeft = Number(data?.mistakesLeft);
          const solvedCategoryIndexes = Array.isArray(data?.solvedCategoryIndexes)
            ? data.solvedCategoryIndexes
            : [];
          if (
            Number.isFinite(mistakesLeft) &&
            mistakesLeft >= 0 &&
            mistakesLeft <= 4 &&
            Array.isArray(solvedCategoryIndexes)
          ) {
            apply({ mistakesLeft, solvedCategoryIndexes });
          }
        } else {
          const local = loadLocalProgress(date);
          if (local) apply(local);
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
  }, [puzzle, date, signedIn, colors.tint]);

  const solvedContents = useMemo(() => {
    const s = new Set<string>();
    for (const group of solved) {
      for (const t of group.tiles) s.add(t.content);
    }
    return s;
  }, [solved]);

  const remainingTiles = useMemo(
    () => tiles.filter((t) => !solvedContents.has(t.content)),
    [tiles, solvedContents],
  );

  function toggleTile(content: string) {
    if (solvedContents.has(content)) return;
    setMessage("");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(content)) {
        next.delete(content);
        return next;
      }
      if (next.size >= 4) return next;
      next.add(content);
      return next;
    });
  }

  function deselectAll() {
    setMessage("");
    setSelected(new Set());
  }

  function onShuffle() {
    setMessage("");
    setTiles((t) => {
      const solvedSet = solvedContents;
      const solvedTiles = t.filter((x) => solvedSet.has(x.content));
      const unsolvedTiles = t.filter((x) => !solvedSet.has(x.content));
      return [...solvedTiles, ...shuffle(unsolvedTiles)];
    });
  }

  function submit() {
    if (!puzzle) return;
    if (mistakesLeft <= 0) return;
    if (selected.size !== 4) {
      setMessage("Select 4 tiles");
      return;
    }

    const selectedTiles = tiles.filter((t) => selected.has(t.content));
    if (selectedTiles.length !== 4) {
      setMessage("Select 4 tiles");
      return;
    }

    const categoryIndex = selectedTiles[0].categoryIndex;
    const isMatch = selectedTiles.every(
      (t) => t.categoryIndex === categoryIndex,
    );

    if (!isMatch) {
      setMistakesLeft((m) => Math.max(0, m - 1));
      setMessage("Not a group");
      return;
    }

    const title = normalizeCategoryTitle(
      puzzle.categories[categoryIndex]?.title ?? "",
    );
    const color = GROUP_COLORS[categoryIndex] ?? colors.tint;

    setSolved((prev) => {
      if (prev.some((g) => g.categoryIndex === categoryIndex)) return prev;
      return [...prev, { title, tiles: selectedTiles, color, categoryIndex }];
    });

    setSelected(new Set());
    setMessage("Group found!");
  }

  const isComplete = solved.length === 4;
  const isDone = isComplete || mistakesLeft <= 0;

  // Persist progress (signed-in -> API, signed-out -> localStorage).
  useEffect(() => {
    if (!puzzle || !date) return;
    if (signedIn === null) return;
    if (!progressLoaded) return;
    const solvedCategoryIndexes = solved.map((g) => g.categoryIndex);
    const payload = {
      mistakesLeft,
      solvedCategoryIndexes,
    };

    if (signedIn) {
      fetch("/api/connections/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date, ...payload }),
      }).catch(() => {});
    } else {
      saveLocalProgress(date, payload);
    }
  }, [puzzle, date, signedIn, progressLoaded, mistakesLeft, solved]);

  // Record win/loss exactly once, then fetch stats.
  useEffect(() => {
    if (!isDone) return;
    if (signedIn === null) return;
    if (!progressLoaded) return;
    if (resultRecordedRef.current) return;
    resultRecordedRef.current = true;

    const mistakesUsed = Math.min(4, Math.max(0, 4 - mistakesLeft));

    const updateLocal = () => {
      const currentStats = loadLocalStats();
      const next: ConnectionsStats = {
        ...currentStats,
        games_played: currentStats.games_played + 1,
        connections_completed:
          currentStats.connections_completed + (isComplete ? 1 : 0),
        distribution: { ...currentStats.distribution },
        winRate: 0,
      };
      if (isComplete) {
        const k = `connections_in_${mistakesUsed}`;
        next.distribution[k] = (next.distribution[k] || 0) + 1;
      }
      next.winRate =
        next.games_played > 0
          ? Math.round((next.connections_completed / next.games_played) * 100)
          : 0;
      saveLocalStats(next);
      setStats(next);
    };

    (async () => {
      try {
        if (signedIn) {
          if (isComplete) {
            fetch("/api/connections/win", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ mistakesUsed }),
            }).catch(() => {});
          } else {
            fetch("/api/connections/loss", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
            }).catch(() => {});
          }

          const resp = await fetch("/api/connections/stats", {
            method: "GET",
            credentials: "include",
          });
          if (resp.ok) {
            const data = (await resp.json()) as ConnectionsStats;
            setStats(data);
            if (Platform.OS !== "web") setShowStatsModal(true);
          }
        } else {
          updateLocal();
        }
      } catch {
        if (!signedIn) updateLocal();
      }
    })();
  }, [isDone, isComplete, mistakesLeft, signedIn, progressLoaded]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={styles.backBtn}
          >
            <FiArrowLeft size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Connections</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.text }]}> 
          {(puzzle?.print_date ?? date) || "\u00A0"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tint} />
          <Text style={[styles.subtitle, { color: colors.text }]}>
            Loading puzzle...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: colors.text }]}>
            {stringifyError(error)}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text }]}>
            Try reloading.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.text }]}>
              Selected: {selected.size}/4
            </Text>
          </View>

          {solved.length > 0 ? (
            <View style={styles.solvedWrap}>
              {solved.map((g) => (
                <View
                  key={g.title}
                  style={[
                    styles.solvedGroup,
                    { backgroundColor: g.color },
                    // Make the solved group span the same width as the 4-column grid
                    { width: gridWidth, alignSelf: "center" },
                  ]}
                >
                  <Text
                    style={[
                      styles.solvedTitle,
                      { color: readableTextOn(g.color) },
                    ]}
                  >
                    {g.title}
                  </Text>
                  <Text
                    style={[
                      styles.solvedWords,
                      { color: readableTextOn(g.color) },
                    ]}
                  >
                    {g.tiles.map((t) => t.content).join(" - ")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.grid}>
            {remainingTiles.map((t) => {
              const isSelected = selected.has(t.content);
              return (
                <Pressable
                  key={t.content}
                  onPress={() => toggleTile(t.content)}
                  accessibilityRole="button"
                  style={[
                    styles.tile,
                    { width: tileWidth },
                    {
                      backgroundColor:
                        colorScheme === "light"
                          ? CONNECTIONS_TILE_LIGHT_BG
                          : colors.icon,
                    },
                    isSelected && {
                      backgroundColor:
                        colorScheme === "light"
                          ? CONNECTIONS_TILE_LIGHT_SELECTED
                          : colors.tint,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tileText,
                      {
                        color: isSelected
                          ? readableTextOn(colors.tint)
                          : colors.text,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {t.content}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.mistakesRow}>
            <Text style={[styles.meta, { color: colors.text, marginRight: 8 }]}>
              Mistakes left
            </Text>
            {[0, 1, 2, 3].map((i) => {
              const filled = i < mistakesLeft;
              return (
                <View
                  key={i}
                  style={[
                    styles.mistakeDot,
                    filled
                      ? {
                          backgroundColor: colors.tint,
                          borderColor: colors.tint,
                        }
                      : {
                          borderColor: colors.icon,
                          backgroundColor: "transparent",
                          opacity: 0.35,
                        },
                  ]}
                />
              );
            })}
          </View>

          {!!message && (
            <Text style={[styles.message, { color: colors.text }]}>
              {message}
            </Text>
          )}

          {isComplete ? (
            <Text style={[styles.win, { color: colors.text }]}>
              You solved it!
            </Text>
          ) : mistakesLeft <= 0 ? (
            <Text style={[styles.win, { color: colors.text }]}>
              Out of mistakes.
            </Text>
          ) : null}

          <View style={styles.controls}>
            <Pressable
              onPress={deselectAll}
              style={[styles.controlBtn, { backgroundColor: colors.icon }]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.controlText,
                  { color: readableTextOn(colors.icon) },
                ]}
              >
                Deselect
              </Text>
            </Pressable>
            <Pressable
              onPress={onShuffle}
              style={[styles.controlBtn, { backgroundColor: colors.icon }]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.controlText,
                  { color: readableTextOn(colors.icon) },
                ]}
              >
                Shuffle
              </Text>
            </Pressable>
            <Pressable
              onPress={submit}
              style={[styles.controlBtn, { backgroundColor: colors.tint }]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.controlText,
                  { color: readableTextOn(colors.tint) },
                ]}
              >
                Submit
              </Text>
            </Pressable>
          </View>

          {isDone && stats && (
            <View style={{ marginTop: 10, alignSelf: "center", width: gridWidth }}>
              <StatsChart
                title="Connections Stats"
                stats={stats}
                distributionKeys={[
                  "connections_in_0",
                  "connections_in_1",
                  "connections_in_2",
                  "connections_in_3",
                  "connections_in_4",
                ]}
                distributionLabels={(key) => key.replace("connections_in_", "")}
              />
            </View>
          )}
        </>
      )}

      {Platform.OS !== "web" && stats && (
        <Modal
          visible={showStatsModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStatsModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={[styles.title, { color: colors.text }]}>Stats</Text>
                <Pressable
                  onPress={() => setShowStatsModal(false)}
                  style={[styles.controlBtn, { backgroundColor: colors.tint }]}
                >
                  <Text style={[styles.controlText, { color: readableTextOn(colors.tint) }]}>
                    Close
                  </Text>
                </Pressable>
              </View>
              <View style={{ marginTop: 12 }}>
                <StatsChart
                  title="Connections Stats"
                  stats={stats}
                  distributionKeys={[
                    "connections_in_0",
                    "connections_in_1",
                    "connections_in_2",
                    "connections_in_3",
                    "connections_in_4",
                  ]}
                  distributionLabels={(key) => key.replace("connections_in_", "")}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 8 },
  header: { alignItems: "center", gap: 4, paddingBottom: 6 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 13, opacity: 0.9 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  error: { fontSize: 14, textAlign: "center" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  meta: { fontSize: 13, opacity: 0.9 },
  solvedWrap: { gap: 8, paddingVertical: 6 },
  solvedGroup: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { padding: 6 },
  solvedTitle: { fontSize: 13, fontWeight: "800" },
  solvedWords: { fontSize: 12, fontWeight: "600", marginTop: 3 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    paddingVertical: 4,
    justifyContent: "center",
    width: "50%",
    alignSelf: "center",
  },
  tile: {
    // Dynamic width calculated for 4 columns
    minWidth: 0,
    // 1x2 ratio (1 tall, 2 wide): width / height = 2
    aspectRatio: 2,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  tileText: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  message: { textAlign: "center", paddingVertical: 4, fontSize: 13 },
  win: {
    textAlign: "center",
    paddingVertical: 4,
    fontSize: 15,
    fontWeight: "800",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingTop: 4,
  },
  controlBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  controlText: { fontWeight: "800" },
  mistakesRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingTop: 6,
    paddingBottom: 6,
    alignItems: "center",
  },
  mistakeDot: { width: 14, height: 14, borderRadius: 14, borderWidth: 1 },
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
