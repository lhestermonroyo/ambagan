import { getPrimaryHex } from "@/utils/getColorHex";

// Shared native large-title header styling for the tab stacks (Groups, Friends,
// Profile). The root navigation ThemeProvider is pinned to light, so we set the
// header colors explicitly from the app's *effective* color scheme (nativewind's
// useColorScheme) to keep the native header in sync with the themed content in
// dark mode. On iOS 26 the header buttons render inside the system "liquid
// glass" capsule automatically.
export function getNativeHeaderScreenOptions(colorScheme: "light" | "dark") {
  const isDark = colorScheme === "dark";
  const background = isDark ? "#121212" : "#FFFFFF";
  const title = isDark ? "#FEFEFF" : "#171717";

  return {
    headerLargeTitle: true,
    headerStyle: { backgroundColor: background },
    // Tints the native header buttons (and any back chevron) with the brand
    // purple — matches the selected tab tint.
    headerTintColor: getPrimaryHex("text-primary-600", colorScheme),
    headerTitleStyle: { color: title },
    headerLargeTitleStyle: { color: title }
  };
}
