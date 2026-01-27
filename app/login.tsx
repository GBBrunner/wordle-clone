import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import GoogleSignInLink from "../components/GoogleSignInLink";

export default function Login() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>Welcome! Sign in to continue.</Text>
        <GoogleSignInLink />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121213", padding: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#ddd", fontSize: 16 },
});
