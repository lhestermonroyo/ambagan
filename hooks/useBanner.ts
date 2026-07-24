import { useNetwork } from "@/hooks/useNetwork";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Height of the banner's content row (icon/text + its bottom padding) that sits
// below the safe-area inset. Keep in sync with OfflineBanner.
export const BANNER_CONTENT_HEIGHT = 30;

// Top padding a full-height (snapPoints=100) sheet uses to clear its drag area
// when no banner is showing (pt-[4rem] on iOS, pt-[3rem] on Android).
const SHEET_TOP_BASE = Platform.OS === "android" ? 48 : 64;

/**
 * Single source of truth for the offline banner.
 *
 * `visible` is true whenever the top banner is on screen; `height` is its total
 * pixel height (safe-area inset + content row). Layouts push the whole
 * navigation stack down by `height` so the native headers clear the banner, and
 * full-height sheets (which render in a portal above the banner) use
 * `sheetTopInset` to drop their content clear of it.
 */
export function useBanner() {
  const { isOnline } = useNetwork();
  const { top } = useSafeAreaInsets();

  const visible = !isOnline;
  const height = visible ? top + BANNER_CONTENT_HEIGHT : 0;

  return {
    visible,
    height,
    sheetTopInset: Math.max(SHEET_TOP_BASE, height)
  };
}
