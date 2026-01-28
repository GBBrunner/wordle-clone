import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V32", "B", "N", "M", "DEL"],
];

type Props = {
  onKey: (key: string) => void;
  keyStates?: Record<string, "correct" | "present" | "absent">;
};

export default function Keyboard({ onKey, keyStates = {} }: Props) {
  return (
    <View style={styles.kb}>
      {ROWS.map((row, ri) => (
        <View key={ri} style={styles.kbRow}>
          {row.map((key) => {
            const lower = key.toLowerCase();
            const state = keyStates[lower];
            return (
              <Pressable
                key={key}
                onPress={() => onKey(key)}
                style={[styles.key, state && styles[state]]}
              >
                <Text style={styles.keyText}>{key}</Text>
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
    backgroundColor: "#818384",
  },
  keyText: { color: "#fff", fontWeight: "700" },
  correct: { backgroundColor: "#6aaa64" },
  present: { backgroundColor: "#c9b458" },
  absent: { backgroundColor: "#3a3a3c" },
});
