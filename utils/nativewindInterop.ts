import { Image as ExpoImage } from "expo-image";
import { cssInterop } from "nativewind";

/**
 * nativewind v4 only auto-applies its `className → style` transform to React
 * Native core components. Third-party components like expo-image's `Image` are
 * NOT interop'd by default, so a `className` passed to them is silently dropped
 * — the image ends up with no width/height and renders blank (0×0).
 *
 * Registering the interop once here (imported early from the root layout) makes
 * `className` work on every `<Image />` from expo-image across the app, e.g. the
 * proof-of-payment previews in ImageViewerSheet and ReviewRequestPaidSheet.
 */
cssInterop(ExpoImage, { className: "style" });
