import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Dashboard() {
  const { signedIn, isClient } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  useEffect(() => {
    if (isClient && signedIn === false) {
      window.location.href = "/login";
    }
  }, [signedIn, isClient]);

  useEffect(() => {
    const loadProfile = async () => {
      if (signedIn) {
        try {
          const res = await fetch("/api/auth/profile", {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            setName(data.name || null);
            setJoined(data.joined || null);
          }
        } catch {}
      }
    };
    loadProfile();
  }, [signedIn]);

  const onSignOut = async () => {
    try {
      // Hitting serverless signout to clear HttpOnly cookie, then redirect home
      if (typeof window !== "undefined") {
        window.location.href = "/api/auth/signout";
        return;
      }
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch {
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  };

  // Avoid hydration mismatch: render null during SSR, then render on client
  if (!isClient) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {signedIn === null ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.subtitle}>Checking your session...</Text>
          </View>
        ) : signedIn ? (
          <>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>
              Welcome{name ? `, ${name}` : ""}!
            </Text>
            {joined ? (
              <Text style={styles.meta}>
                Joined: {new Date(joined).toLocaleDateString()}
              </Text>
            ) : null}
            <Pressable
              style={styles.signout}
              onPress={onSignOut}
              accessibilityRole="button"
            >
              <Text style={styles.signoutText}>Sign out</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.subtitle}>Redirecting...</Text>
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
  meta: { color: "#bbb", fontSize: 14 },
  signout: {
    backgroundColor: "#e35d5d",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  signoutText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
