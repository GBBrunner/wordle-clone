import { useLocalSearchParams } from "expo-router";
import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function GoogleCallback() {
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    state?: string;
  }>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Google OAuth Callback</Text>
        {params.error ? (
          <Text style={styles.error}>Error: {String(params.error)}</Text>
        ) : params.code ? (
          <Text style={styles.subtitle}>
            Code received: {String(params.code)}
          </Text>
        ) : (
          <Text style={styles.subtitle}>No code provided.</Text>
        )}
        <Text style={styles.note}>
          Implement server-side token exchange to complete login.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121213", padding: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#ddd", fontSize: 16 },
  note: { color: "#aaa", fontSize: 14, marginTop: 8, textAlign: "center" },
  error: { color: "#ff6b6b", fontSize: 16, fontWeight: "600" },
});
