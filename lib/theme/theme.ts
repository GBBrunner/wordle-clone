import { Colors } from "@/constants/theme";

export const THEME_STORAGE_KEY = "appTheme";

export type ThemeKey =
  | "light"
  | "dark"
  | "lightBlue"
  | "darkBlue"
  | "lightPink"
  | "darkRed";

export const themeOptions: Array<{ key: ThemeKey; label: string }> = [
  { key: "light", label: "Default Light" },
  { key: "dark", label: "Default Dark" },
  { key: "lightBlue", label: "Light Blue" },
  { key: "darkBlue", label: "Dark Blue" },
  { key: "lightPink", label: "Light Pink" },
  { key: "darkRed", label: "Dark Red" },
];

export type ThemeColors = {
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
};

export const themeColors: Record<ThemeKey, ThemeColors> = {
  light: {
    ...Colors.light,
    background: "#f2f2f2",
  },
  dark: {
    ...Colors.dark,
    // Avoid white-on-white UI when tint is used as a background (e.g. selected items).
    tint: "#0a7ea4",
    tabIconSelected: "#0a7ea4",
  },
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

export function isThemeKey(value: unknown): value is ThemeKey {
  return (
    value === "light" ||
    value === "dark" ||
    value === "lightBlue" ||
    value === "darkBlue" ||
    value === "lightPink" ||
    value === "darkRed"
  );
}

export function baseColorSchemeForTheme(theme: ThemeKey): "light" | "dark" {
  return theme === "dark" || theme === "darkBlue" || theme === "darkRed"
    ? "dark"
    : "light";
}

function parseHexColor(
  hex: string,
): { r: number; g: number; b: number } | null {
  const normalized = hex.trim();
  const m = /^#([0-9a-fA-F]{6})$/.exec(normalized);
  if (!m) return null;
  const value = parseInt(m[1], 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function srgbToLinear(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Returns a readable text color (light or dark) for a given hex background.
 * Falls back to `lightText` if the input isn't a 6-digit hex color.
 */
export function readableTextOn(
  backgroundHex: string,
  lightText = "#fff",
  darkText = "#11181C",
) {
  const rgb = parseHexColor(backgroundHex);
  if (!rgb) return lightText;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Threshold chosen to keep mid-greys leaning to dark text.
  return luminance > 0.45 ? darkText : lightText;
}
