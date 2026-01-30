import { useAppTheme } from "@/lib/theme/context";
import { stringifyAny } from "@/lib/utils/stringify";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

type Stats = {
  games_played: number;
  wordles_completed?: number;
  connections_completed?: number;
  completed?: number;
  winRate: number;
  distribution: Record<string, number>;
};

type Props = {
  stats: Stats;
  title?: string;
  distributionKeys?: string[];
  distributionLabels?: (key: string, index: number) => string;
};

export default function StatsChart({
  stats,
  title = "Stats",
  distributionKeys,
  distributionLabels,
}: Props) {
  const { colors } = useAppTheme();

  const keys = useMemo(() => {
    if (distributionKeys && distributionKeys.length > 0)
      return distributionKeys;
    return Array.from({ length: 6 }, (_, i) => `wordle_in_${i + 1}`);
  }, [distributionKeys]);

  const counts = useMemo(
    () => keys.map((k) => stats.distribution[k] || 0),
    [keys, stats],
  );
  const maxCount = Math.max(1, ...counts);
  const BAR_MAX = 220; // px

  const completed =
    typeof stats.completed === "number"
      ? stats.completed
      : typeof stats.wordles_completed === "number"
        ? stats.wordles_completed
        : typeof stats.connections_completed === "number"
          ? stats.connections_completed
          : 0;

  const animsRef = useRef<Animated.Value[]>([]);

  useEffect(() => {
    // Ensure we have exactly one Animated.Value per bar.
    if (animsRef.current.length !== keys.length) {
      animsRef.current = keys.map(() => new Animated.Value(0));
    }
  }, [keys]);

  useEffect(() => {
    // Reset values to 0 then animate to target widths
    animsRef.current.forEach((v) => v.setValue(0));
    const animations = counts.map((count, idx) => {
      const target = (count / maxCount) * BAR_MAX;
      return Animated.timing(animsRef.current[idx], {
        toValue: target,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // animating width
      });
    });
    Animated.stagger(80, animations).start();
  }, [counts, maxCount]);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.meta, { color: colors.text }]}>
        Games played: {stats.games_played} Wins: {completed} Win Rate:{" "}
        {stats.winRate}%
      </Text>
      <View style={{ marginTop: 8, gap: 6 }}>
        {counts.map((count, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>
              {stringifyAny(
                distributionLabels ? distributionLabels(keys[i], i) : i + 1,
              )}
            </Text>
            <View style={[styles.barTrack, { backgroundColor: colors.icon }]}>
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    width: animsRef.current[i],
                    backgroundColor: colors.tint,
                  },
                ]}
              />
            </View>
            <Text style={[styles.count, { color: colors.text }]}>
              {stringifyAny(count)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  title: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 14, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { width: 16, textAlign: "right", fontSize: 14 },
  barTrack: {
    height: 16,
    borderRadius: 8,
    overflow: "hidden",
    flexGrow: 1,
    maxWidth: 240,
  },
  barFill: {
    height: 16,
    borderRadius: 8,
  },
  count: { width: 32, textAlign: "left", fontSize: 14 },
});
