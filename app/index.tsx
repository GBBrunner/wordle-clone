import { useAuth } from "@/hooks/use-auth";
import { useAppTheme } from "@/lib/theme/context";
import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import ConnectionsCardIcon from "../assets/images/card-icons/connections-card-icon.svg";
import WordleCardIcon from "../assets/images/card-icons/wordle-card-icon.svg";

export default function Main() {
  const { signedIn, isClient } = useAuth();
  const { colors } = useAppTheme();
  const [name, setName] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  const dynamicStyles = useMemo(
    () => ({
      container: {
        flex: 1,
        padding: 24,
        backgroundColor: colors.background,
      },
      title: {
        fontSize: 28,
        fontWeight: "800" as const,
        color: colors.text,
      },
      subtitle: {
        fontSize: 16,
        color: colors.text,
      },
      cta: {
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.tint,
      },
    }),
    [colors],
  );

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
    <SafeAreaView style={dynamicStyles.container}>
      <View style={styles.content}>
        <Text style={dynamicStyles.title}>
          Welcome{name ? `, ${name}` : ""}
        </Text>
        {isClient ? null : (
          <Text style={dynamicStyles.subtitle}>This is the main page.</Text>
        )}
        <Link href="/wordle" asChild>
          <Pressable style={dynamicStyles.cta}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <WordleCardIcon
                width={50}
                height={50}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.ctaText}>Play Wordle</Text>
            </View>
          </Pressable>
        </Link>
        <Link href="/connections" asChild>
          <Pressable style={dynamicStyles.cta}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ConnectionsCardIcon
                width={50}
                height={50}
                style={{ marginRight: 12 }}
              />
              <Text style={styles.ctaText}>Play Connections</Text>
            </View>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { fontSize: 16 },
  meta: { fontSize: 14 },
  cta: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
