import createIconSet from "@expo/vector-icons/createIconSet";

// Lucide icons rendered from a font so they can be used on the native iOS 26
// glass tab bar (`NativeTabs`), which only accepts SF Symbols / images — not
// the `lucide-react-native` SVG components we use elsewhere in the app.
//
// The codepoints below are pinned to assets/fonts/lucide.ttf (lucide-static
// v1.24.0). To add more, look the name up in
// node_modules/lucide-static/font/codepoints.json and copy its numeric value.
const glyphMap = {
  wallet: 57860,
  house: 57589,
  users: 57764,
  "circle-user": 58465
} as const;

export type LucideGlyph = keyof typeof glyphMap;

// The returned component exposes a static `getImageSource(name, size, color)`
// which is exactly what `NativeTabs.Trigger.VectorIcon`'s `family` prop needs;
// it self-loads the font, so no separate `useFonts` registration is required.
export const LucideIcon = createIconSet(
  glyphMap,
  "lucide",
  require("@/assets/fonts/lucide.ttf")
);
