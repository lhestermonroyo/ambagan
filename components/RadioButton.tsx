import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Box } from "./ui/box";

const OUTER = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6"
} as const;

const INNER = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-2.5 h-2.5"
} as const;

/**
 * The app's standard radio indicator: a filled primary circle with a white
 * center dot when selected, and a hollow outlined circle when not.
 *
 * This is the presentational (non-interactive) form — use it for manually
 * controlled selection rows/cards where the whole row is the Pressable and
 * you already track the selected state yourself (e.g. the plan cards on the
 * Subscription screen). For sheet-style single-choice lists, prefer the
 * interactive `Radio`/`RadioGroup` from `@/components/ui/radio`, which shares
 * this exact look.
 */
export default function RadioButton({
  selected,
  size = "md",
  className
}: {
  selected: boolean;
  size?: keyof typeof OUTER;
  className?: string;
}) {
  return (
    <Box
      className={cn(
        "rounded-full border-2 items-center justify-center",
        OUTER[size],
        selected
          ? "border-primary-400 bg-primary-400"
          : "border-secondary-400 bg-transparent",
        className
      )}
    >
      {selected && (
        <Box className={cn("rounded-full bg-background-0", INNER[size])} />
      )}
    </Box>
  );
}
