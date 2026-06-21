import {
  getErrorHex,
  getPrimaryHex,
  getSecondaryHex,
  getSuccessHex
} from "@/utils/getColorHex";
import { MaterialIcons } from "@expo/vector-icons";
import { Platform, useColorScheme } from "react-native";
import { Text } from "./ui/text";

function resolveColorFromClassName(
  className: string | undefined,
  colorScheme: "light" | "dark"
): string {
  if (!className) return getSecondaryHex("text-secondary-950", colorScheme);

  const token = className.split(" ").find((t) => t.startsWith("text-")) as
    | string
    | undefined;

  if (!token) return getSecondaryHex("text-secondary-950", colorScheme);

  if (token.startsWith("text-primary-"))
    return getPrimaryHex(token as any, colorScheme);
  if (
    token.startsWith("text-secondary-") ||
    token.startsWith("text-background-")
  )
    return getSecondaryHex(token as any, colorScheme);
  if (token.startsWith("text-error-"))
    return getErrorHex(token as any, colorScheme);
  if (token.startsWith("text-success-"))
    return getSuccessHex(token as any, colorScheme);

  return getSecondaryHex("text-secondary-950", colorScheme);
}

export default function Icon({
  as,
  size,
  className
}: {
  as: React.ComponentProps<typeof MaterialIcons>["name"];
  size?: number;
  className?: string;
}) {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

  if (Platform.OS === "android") {
    const color = resolveColorFromClassName(className, colorScheme);
    return <MaterialIcons name={as} size={size || 24} color={color} />;
  }

  return (
    <Text className={className} style={{ lineHeight: 0 }}>
      <MaterialIcons name={as} size={size || 24} />
    </Text>
  );
}
