import { getNativeHeaderScreenOptions } from "@/utils/nativeHeader";
import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";

export default function BooksStackLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <Stack screenOptions={getNativeHeaderScreenOptions(colorScheme ?? "light")} />
  );
}
