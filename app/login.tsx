import { useAuth } from "@/hooks/use-auth";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import GoogleSignInLink from "../components/GoogleSignInLink";

export default function Login() {
  const { signedIn } = useAuth();

  useEffect(() => {
    if (signedIn) {
      router.replace("/dashboard");
    }
  }, [signedIn]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Login</Text>
        {signedIn === null ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.subtitle}>Checking your session…</Text>
          </View>
        ) : signedIn ? (
          <Text style={styles.subtitle}>Redirecting…</Text>
        ) : (
          <>
            <Text style={styles.subtitle}>Welcome! Sign in to continue.</Text>
            <GoogleSignInLink />
          </>
        )}
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
