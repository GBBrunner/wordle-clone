import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Link, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ThemeDropdown } from "@/components/ThemeDropdown";
import { UserIcon } from "@/components/ui/user-icon";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AppThemeProvider, useAppTheme } from "@/lib/theme/context";
import { Platform, Pressable, View } from "react-native";

// Removed anchor to tabs; focusing app on Wordle screen.

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutInner />
    </AppThemeProvider>
  );
}

function RootLayoutInner() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="index">
        <Stack.Screen
          name="index"
          options={{
            title: "Home",
            headerRight: () => <HeaderRight />,
          }}
        />
        <Stack.Screen
          name="wordle"
          options={{
            title: "Wordle",
            // Enable default back arrow to previous screen (Home)
            headerRight: () => <HeaderRight />,
          }}
        />
        <Stack.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            headerRight: () => <HeaderRight />,
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            title: "Login",
            headerRight: () => <HeaderRight />,
          }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function HeaderRight() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <ThemeDropdown compact />
      <HeaderUserLink />
    </View>
  );
}

function HeaderUserLink() {
  const colorScheme = useColorScheme();
  const { signedIn, isClient } = useAuth();
  const { colors } = useAppTheme();

  // Avoid hydration mismatch: render empty placeholder during SSR
  if (!isClient) {
    return <View style={{ width: 32, height: 32 }} />;
  }

  const href = signedIn ? "/dashboard" : "/login";
  if (Platform.OS === "web") {
    // Use a plain anchor on web to avoid RN touch event issues
    return (
      <Link href={href}>
        <UserIcon size={32} color={colors?.tint ?? Colors[colorScheme ?? "light"].tint} />
      </Link>
    );
  }
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" hitSlop={8}>
        <UserIcon size={32} color={colors?.tint ?? Colors[colorScheme ?? "light"].tint} />
      </Pressable>
    </Link>
  );
}
