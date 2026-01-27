import { Link } from "expo-router";
import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function Main() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>This is the main page.</Text>
        <Link href="/wordle" asChild>
          <Pressable style={styles.cta}>
            <Text style={styles.ctaText}>Play Wordle</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121213", padding: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#ddd", fontSize: 16 },
  cta: {
    backgroundColor: "#6aaa64",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
