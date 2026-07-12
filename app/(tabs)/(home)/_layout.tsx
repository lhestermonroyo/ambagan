import { getNativeHeaderScreenOptions } from "@/utils/nativeHeader";
import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";

export default function HomeStackLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <Stack screenOptions={getNativeHeaderScreenOptions(colorScheme ?? "light")} />
  );
}
