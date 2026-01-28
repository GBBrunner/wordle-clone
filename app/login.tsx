import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import GoogleSignInLink from "../components/GoogleSignInLink";

export default function Login() {
  const { signedIn, isClient } = useAuth();

  useEffect(() => {
    if (isClient && signedIn === true) {
      window.location.href = "/dashboard";
    }
  }, [signedIn, isClient]);

  // Single render path to avoid hydration mismatch
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Login</Text>
        {!isClient || signedIn === null ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.subtitle}>Checking your session...</Text>
          </View>
        ) : signedIn ? (
          <Text style={styles.subtitle}>Redirecting...</Text>
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
