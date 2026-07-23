import { getPrimaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { LucideIcon } from "lucide-react-native";
import { useColorScheme } from "react-native";
import { Box } from "./ui/box";

/**
 * Circular badge for a category's lucide icon — mirrors the "What you get"
 * list styling on the subscription screen. Pass `variant="onSolid"` when it
 * sits on a filled primary surface (e.g. a selected picker pill) so the badge
 * inverts to stay legible.
 */
export default function CategoryIcon({
  icon: IconCmp,
  size = 18,
  variant = "default"
}: {
  icon: LucideIcon;
  size?: number;
  variant?: "default" | "onSolid";
}) {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const isOnSolid = variant === "onSolid";

  return (
    <Box
      className={cn(
        "p-1.5 rounded-full",
        isOnSolid ? "bg-background-0" : "bg-primary-50"
      )}
    >
      <IconCmp
        size={size}
        color={getPrimaryHex("text-primary-600", colorScheme)}
      />
    </Box>
  );
}
