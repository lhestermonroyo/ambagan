import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { ChevronDown } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { formatAmount } from "../utils/formatAmount";

// Match the computation breakdown in settlement sheets.
const transition = {
  duration: 280,
  easing: Easing.inOut(Easing.cubic),
  reduceMotion: ReduceMotion.System
};

export default function ExpenseSplitBreakdown({
  expanded,
  onToggle,
  rows,
  currency,
  surface = "default"
}: {
  expanded: boolean;
  onToggle: () => void;
  rows: { id: string; name: string; amount: number; percentage: number }[];
  currency: string;
  surface?: "default" | "muted";
}) {
  const colorScheme = useColorScheme() ?? "light";
  const [contentHeight, setContentHeight] = useState(0);
  const [hovered, setHovered] = useState(false);
  const height = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    height.value = withTiming(expanded ? contentHeight : 0, transition);
  }, [expanded, contentHeight, height]);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, transition);
  }, [expanded, progress]);

  const contentStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: progress.value,
    overflow: "hidden"
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }]
  }));

  return (
    <>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
      >
        {({ pressed }) => (
          <Box
            className={cn(
              "px-4 py-3 border-t border-background-200",
              surface === "muted"
                ? pressed || hovered
                  ? "bg-secondary-200"
                  : "bg-secondary-100"
                : pressed
                  ? "bg-background-50"
                  : "bg-background-0"
            )}
          >
            <HStack className="items-center justify-center gap-x-1">
              <Text
                bold={surface === "default"}
                className={
                  surface === "muted"
                    ? "text-sm text-secondary-950"
                    : "text-sm text-primary-500"
                }
              >
                {expanded ? "Hide Breakdown" : "Show Breakdown"}
              </Text>
              <Animated.View style={chevronStyle}>
                <ChevronDown
                  size={18}
                  color={
                    surface === "muted"
                      ? getSecondaryHex("text-secondary-950", colorScheme)
                      : getPrimaryHex("text-primary-500", colorScheme)
                  }
                />
              </Animated.View>
            </HStack>
          </Box>
        )}
      </Pressable>

      <Animated.View
        style={contentStyle}
        pointerEvents={expanded ? "auto" : "none"}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
      >
        <VStack
          className={cn(
            "border-t border-background-200 gap-y-2 py-2",
            surface === "muted" && "bg-secondary-100"
          )}
          style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          onLayout={(event) =>
            setContentHeight(event.nativeEvent.layout.height)
          }
        >
          {rows.map((row) => (
            <HStack
              key={row.id}
              className="justify-between items-center gap-x-2 px-4 py-2"
            >
              <Text className="flex-1" numberOfLines={1}>
                {row.name}
              </Text>
              <Text className="text-secondary-950 text-sm w-14 text-right">
                {row.percentage.toFixed(1)}%
              </Text>
              <Text bold className="text-right">
                {formatAmount(row.amount, currency)}
              </Text>
            </HStack>
          ))}
        </VStack>
      </Animated.View>
    </>
  );
}
