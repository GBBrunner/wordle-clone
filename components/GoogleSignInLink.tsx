import * as Linking from "expo-linking";
import React from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
// Web-only Google icon from react-icons (conditionally required to avoid native bundling issues)
const WebGoogleIcon =
  Platform.OS === "web" ? require("react-icons/fc").FcGoogle : null;
// Native fallback icon
import { AntDesign } from "@expo/vector-icons";

function randomState() {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.crypto?.getRandomValues
  ) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return String(Date.now());
}

function buildGoogleAuthUrl(state?: string) {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) return null;

  const scope = encodeURIComponent("openid email profile");
  const base = "https://accounts.google.com/o/oauth2/v2/auth";

  const url =
    `${base}?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&access_type=offline` +
    `&prompt=consent` +
    (state ? `&state=${encodeURIComponent(state)}` : "");

  return url;
}

export default function GoogleSignInLink() {
  const authUrl = buildGoogleAuthUrl();

  if (!authUrl) {
    return (
      <Text style={styles.error}>
        Missing Google OAuth env vars. Set `GOOGLE_CLIENT_ID` and
        `GOOGLE_REDIRECT_URI`.
      </Text>
    );
  }

  if (Platform.OS === "web") {
    const handleClick = () => {
      const state = randomState();
      // Store state in a cookie for server-side validation
      document.cookie = `oauth_state=${state}; Path=/; SameSite=Lax`;
      const urlWithState = buildGoogleAuthUrl(state);
      window.location.href = urlWithState!;
    };
    return (
      <button onClick={handleClick} style={styles.webAnchor as any}>
        <span style={styles.iconWrap as any}>
          {WebGoogleIcon ? <WebGoogleIcon size={20} /> : null}
        </span>
        <span style={styles.label as any}>Sign in with Google</span>
      </button>
    );
  }

  return (
    <Pressable style={styles.button} onPress={() => Linking.openURL(authUrl)}>
      <AntDesign
        name="google"
        size={18}
        color="#121212"
        style={{ marginRight: 8 }}
      />
      <Text style={styles.buttonText}>Sign in with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonText: { color: "#121212", fontWeight: "600", fontSize: 16 },
  error: { color: "#ff6b6b", fontSize: 14, textAlign: "center" },
  webAnchor: {
    display: "inline-flex",
    alignItems: "center",
    textDecoration: "none",
    backgroundColor: "#fff",
    color: "#121212",
    borderRadius: 8,
    padding: "12px 16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    fontWeight: 600,
  },
  iconWrap: { marginRight: 8, display: "inline-flex", alignItems: "center" },
  label: { fontSize: 16 },
});
