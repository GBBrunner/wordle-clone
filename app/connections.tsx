import {
    fetchConnectionsPuzzle,
    getNYTConnectionsDateString,
} from "@/lib/connections/api";
import type {
    ConnectionsCategory,
    ConnectionsPuzzle,
} from "@/lib/connections/types";
import { useAppTheme } from "@/lib/theme/context";
import { readableTextOn } from "@/lib/theme/theme";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";

type Tile = {
  content: string;
  position: number;
  categoryIndex: number;
};

type SolvedGroup = {
  title: string;
  tiles: Tile[];
  color: string;
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
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const containerPadding = 16; // 8 * 2
  const availableWidth = width - containerPadding;
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

  const date = useMemo(() => getNYTConnectionsDateString(), []);

  useEffect(() => {
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
      } catch (e: any) {
        if (cancelled) return;
        setError(String(e?.message ?? e ?? "Failed to load puzzle"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

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
      if (prev.some((g) => g.title === title)) return prev;
      return [...prev, { title, tiles: selectedTiles, color }];
    });

    setSelected(new Set());
    setMessage("Group found!");
  }

  const isComplete = solved.length === 4;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Connections</Text>
        <Text style={[styles.subtitle, { color: colors.text }]}>
          {puzzle?.print_date ?? date}
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
          <Text style={[styles.error, { color: colors.text }]}>{error}</Text>
          <Text style={[styles.subtitle, { color: colors.text }]}>
            Try reloading.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: colors.text }]}>Selected: {selected.size}/4</Text>
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
                    {g.tiles.map((t) => t.content).join(" • ")}
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
                    { backgroundColor: colors.icon },
                    isSelected && { backgroundColor: colors.tint },
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

          <View style={styles.mistakesRow} accessibilityRole="status">
            <Text style={[styles.meta, { color: colors.text, marginRight: 8 }]}>Mistakes left</Text>
            {[0, 1, 2, 3].map((i) => {
              const filled = i < mistakesLeft;
              return (
                <View
                  key={i}
                  style={[
                    styles.mistakeDot,
                    filled
                      ? { backgroundColor: colors.tint, borderColor: colors.tint }
                      : { borderColor: colors.icon, backgroundColor: "transparent", opacity: 0.35 },
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
        </>
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
  tileText: { fontSize: 10, fontWeight: "800", textAlign: "center" },
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
});
