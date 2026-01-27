import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { UserIcon } from "@/components/ui/user-icon";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Removed anchor to tabs; focusing app on Wordle screen.

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="index">
        <Stack.Screen
          name="index"
          options={{
            title: "Home",
            headerRight: () => (
              <UserIcon size={32} color={Colors[colorScheme ?? "light"].tint} />
            ),
          }}
        />
        <Stack.Screen
          name="wordle"
          options={{
            title: "Wordle",
            // Enable default back arrow to previous screen (Home)
            headerRight: () => (
              <UserIcon size={32} color={Colors[colorScheme ?? "light"].tint} />
            ),
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
