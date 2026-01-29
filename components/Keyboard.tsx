import { useAppTheme } from "@/lib/theme/context";
import { readableTextOn } from "@/lib/theme/theme";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DEL"],
];

type Props = {
  onKey: (key: string) => void;
  keyStates?: Record<string, "correct" | "present" | "absent">;
};

export default function Keyboard({ onKey, keyStates = {} }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.kb}>
      {ROWS.map((row, ri) => (
        <View key={ri} style={styles.kbRow}>
          {row.map((key) => {
            const lower = key.toLowerCase();
            const state = keyStates[lower];
            const neutralKeyBg = "#d3d6da";
            const neutralKeyText = "#11181C";
            const themedKeyBg = colors.tint;

            // Only theme ENTER/DEL; letter keys stay neutral.
            const bg = state
              ? undefined
              : key === "ENTER" || key === "DEL"
                ? themedKeyBg
                : neutralKeyBg;

            // Universal text color for neutral keys; evaluated keys remain white.
            const textColor = state
              ? "#fff"
              : key === "ENTER" || key === "DEL"
                ? readableTextOn(themedKeyBg)
                : neutralKeyText;
            return (
              <Pressable
                key={key}
                onPress={() => onKey(key)}
                style={[
                  styles.key,
                  !state && { backgroundColor: bg },
                  state && styles[state],
                ]}
              >
                <Text style={[styles.keyText, { color: textColor }]}>
                  {key}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  kb: { gap: 8 },
  kbRow: { flexDirection: "row", justifyContent: "center", gap: 6 },
  key: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 6,
  },
  keyText: { fontWeight: "700" },
  correct: { backgroundColor: "#6aaa64" },
  present: { backgroundColor: "#c9b458" },
  absent: { backgroundColor: "#3a3a3c" },
});
