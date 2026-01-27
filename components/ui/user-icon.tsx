import React from "react";
import type { OpaqueColorValue } from "react-native";
import { Platform } from "react-native";
import { IconSymbol } from "./icon-symbol";

type Props = {
  size?: number;
  color: string | OpaqueColorValue;
};

export function UserIcon({ size = 24, color }: Props) {
  if (Platform.OS === "web") {
    // Use react-icons on web for the user icon
    const { FaUserCircle } = require("react-icons/fa");
    return <FaUserCircle size={size} color={String(color)} />;
  }
  return <IconSymbol name="person.circle" size={size} color={color} />;
}
