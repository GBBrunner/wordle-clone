import { useAuth } from "@/hooks/use-auth";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function Main() {
  const { signedIn, isClient } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (signedIn && isClient) {
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
      } else {
        setName(null);
        setJoined(null);
      }
    };
    loadProfile();
  }, [signedIn, isClient]);

  // Avoid hydration mismatch: render exact same content during SSR as initial client render
  // Auth-dependent content only shown after client mount
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome{isClient && name ? `, ${name}` : ""}</Text>
        {isClient ? (
          <>
            <Text style={styles.subtitle}>
              {signedIn ? "You're signed in." : "This is the main page."}
            </Text>
            {signedIn && joined ? (
              <Text style={styles.meta}>
                Joined: {new Date(joined).toLocaleDateString()}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.subtitle}>This is the main page.</Text>
        )}
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
  meta: { color: "#bbb", fontSize: 14 },
  cta: {
    backgroundColor: "#6aaa64",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
