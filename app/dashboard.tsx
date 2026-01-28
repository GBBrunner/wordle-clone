import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Colors } from "@/constants/theme";
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
  const themeOptions = [
    { key: "light", label: "Default Light" },
    { key: "dark", label: "Default Dark" },
    { key: "lightBlue", label: "Light Blue" },
    { key: "darkBlue", label: "Dark Blue" },
    { key: "lightPink", label: "Light Pink" },
    { key: "darkRed", label: "Dark Red" },
  ];
  const themeColors = {
    light: Colors.light,
    dark: Colors.dark,
    lightBlue: {
      ...Colors.light,
      background: "#e3f2fd",
      text: "#0d47a1",
      tint: "#1976d2",
    },
    darkBlue: {
      ...Colors.dark,
      background: "#0d1b2a",
      text: "#90caf9",
      tint: "#1976d2",
    },
    lightPink: {
      ...Colors.light,
      background: "#ffe4ec",
      text: "#ad1457",
      tint: "#d81b60",
    },
    darkRed: {
      ...Colors.dark,
      background: "#2d0000",
      text: "#ff8a80",
      tint: "#d32f2f",
    },
  };
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dashboardTheme") || "light";
    }
    return "light";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboardTheme", theme);
    }
  }, [theme]);

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
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors[theme].background }]}> 
      <View style={styles.content}>
        <View style={{ marginBottom: 24, alignItems: "center" }}>
          <Text style={[styles.title, { color: themeColors[theme].text }]}>Theme Selector</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {themeOptions.map(opt => (
              <Pressable
                key={opt.key}
                style={{
                  backgroundColor: theme === opt.key ? themeColors[theme].tint : themeColors[theme].icon,
                  borderRadius: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  margin: 2,
                }}
                onPress={() => setTheme(opt.key)}
                accessibilityRole="button"
              >
                <Text style={{ color: theme === opt.key ? "#fff" : themeColors[theme].text, fontWeight: "600" }}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {signedIn === null ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <ActivityIndicator color={themeColors[theme].tint} />
            <Text style={[styles.subtitle, { color: themeColors[theme].text }]}>Checking your session...</Text>
          </View>
        ) : signedIn ? (
          <>
            <Text style={[styles.title, { color: themeColors[theme].text }]}>Dashboard</Text>
            <Text style={[styles.subtitle, { color: themeColors[theme].text }]}>
              Welcome{name ? `, ${name}` : ""}!
            </Text>
            {joined ? (
              <Text style={[styles.meta, { color: themeColors[theme].text }]}>
                Joined: {new Date(joined).toLocaleDateString()}
              </Text>
            ) : null}
            <Pressable
              style={[styles.signout, { backgroundColor: themeColors[theme].tint }]}
              onPress={onSignOut}
              accessibilityRole="button"
            >
              <Text style={styles.signoutText}>Sign out</Text>
            </Pressable>
          </>
        ) : (
          <Text style={[styles.subtitle, { color: themeColors[theme].text }]}>Redirecting...</Text>
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
