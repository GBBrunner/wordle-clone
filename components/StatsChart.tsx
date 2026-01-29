import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/lib/theme/context";

type Stats = {
  games_played: number;
  wordles_completed: number;
  winRate: number;
  distribution: Record<string, number>;
};

type Props = {
  stats: Stats;
};

export default function StatsChart({ stats }: Props) {
  const { colors } = useAppTheme();

  const counts = useMemo(
    () => Array.from({ length: 6 }, (_, i) => stats.distribution[`wordle_in_${i + 1}`] || 0),
    [stats],
  );
  const maxCount = Math.max(1, ...counts);
  const BAR_MAX = 220; // px

  const animsRef = useRef(counts.map(() => new Animated.Value(0)));

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
      <Text style={[styles.title, { color: colors.text }]}>Stats</Text>
      <Text style={[styles.meta, { color: colors.text }]}>Games played: {stats.games_played}  Win Rate: {stats.winRate}%</Text>
      <View style={{ marginTop: 8, gap: 6 }}>
        {counts.map((count, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>{i + 1}</Text>
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
            <Text style={[styles.count, { color: colors.text }]}>{count}</Text>
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
