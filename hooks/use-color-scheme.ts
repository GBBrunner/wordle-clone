import { useAppTheme } from "@/lib/theme/context";

export function useColorScheme() {
  const { colorScheme, hasHydrated } = useAppTheme();
  // Keep SSR/initial render stable
  return hasHydrated ? colorScheme : "light";
}
