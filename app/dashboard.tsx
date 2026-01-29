import { useAuth } from "@/hooks/use-auth";
import { useAppTheme } from "@/lib/theme/context";
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
  const { colors } = useAppTheme();
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        {signedIn === null ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <ActivityIndicator color={colors.tint} />
            <Text style={[styles.subtitle, { color: colors.text }]}>
              Checking your session...
            </Text>
          </View>
        ) : signedIn ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              Dashboard
            </Text>
            <Text style={[styles.subtitle, { color: colors.text }]}>
              Welcome{name ? `, ${name}` : ""}!
            </Text>
            {joined ? (
              <Text style={[styles.meta, { color: colors.text }]}>
                Joined: {new Date(joined).toLocaleDateString()}
              </Text>
            ) : null}
            <Pressable
              style={[styles.signout, { backgroundColor: colors.tint }]}
              onPress={onSignOut}
              accessibilityRole="button"
            >
              <Text style={styles.signoutText}>Sign out</Text>
            </Pressable>
          </>
        ) : (
          <Text style={[styles.subtitle, { color: colors.text }]}>
            Redirecting...
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { fontSize: 16 },
  meta: { fontSize: 14 },
  signout: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  signoutText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
