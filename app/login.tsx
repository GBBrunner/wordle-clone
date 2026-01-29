import { useAuth } from "@/hooks/use-auth";
import { useAppTheme } from "@/lib/theme/context";
import { useEffect, useMemo } from "react";
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
  const { colors } = useAppTheme();

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
    }),
    [colors]
  );

  useEffect(() => {
    if (isClient && signedIn === true) {
      window.location.href = "/dashboard";
    }
  }, [signedIn, isClient]);

  // Avoid hydration mismatch: render null during SSR, then render on client
  if (!isClient) {
    return null;
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={styles.content}>
        <Text style={dynamicStyles.title}>Login</Text>
        {signedIn === null ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <ActivityIndicator color={colors.tint} />
            <Text style={dynamicStyles.subtitle}>Checking your session...</Text>
          </View>
        ) : signedIn ? (
          <Text style={dynamicStyles.subtitle}>Redirecting...</Text>
        ) : (
          <>
            <Text style={dynamicStyles.subtitle}>Welcome! Sign in to continue.</Text>
            <GoogleSignInLink />
          </>
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
});
