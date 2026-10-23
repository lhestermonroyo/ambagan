// Motion and liquid filter adapted from Amicro's Liquid Dots (MIT).
// https://github.com/Subhan-code/Amicro--Micro-transitions-/blob/main/registry/ui/loading/liquid-dots.tsx
// License: documentation/licenses/amicro-MIT.txt
import { getPrimaryHex } from "@/utils/getColorHex";
import { useEffect, useId } from "react";
import { useColorScheme, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  FeBlend,
  FeColorMatrix,
  FeGaussianBlur,
  Filter,
  G
} from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function LiquidDots() {
  const color = getPrimaryHex("text-primary-500", useColorScheme());
  const filterId = `liquid-dots-${useId().replace(/:/g, "")}`;
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(-16);

  useEffect(() => {
    if (reducedMotion) return;
    offset.value = withRepeat(
      withTiming(16, {
        duration: 1000,
        easing: Easing.bezier(0.42, 0, 0.58, 1)
      }),
      -1,
      true
    );
    return () => cancelAnimation(offset);
  }, [offset, reducedMotion]);

  const firstDotProps = useAnimatedProps(() => ({ cx: 32 + offset.value }));
  const secondDotProps = useAnimatedProps(() => ({ cx: 32 - offset.value }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading Ambagan"
      accessibilityState={{ busy: true }}
      pointerEvents="none"
    >
      <Svg width={64} height={32} viewBox="0 0 64 32" accessible={false}>
        <Defs>
          <Filter
            id={filterId}
            x={-16}
            y={-16}
            width={96}
            height={64}
            filterUnits="userSpaceOnUse"
          >
            <FeGaussianBlur in="SourceGraphic" stdDeviation={4} result="blur" />
            <FeColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <FeBlend in="SourceGraphic" in2="goo" />
          </Filter>
        </Defs>
        <G filter={reducedMotion ? undefined : `url(#${filterId})`}>
          <AnimatedCircle
            cx={16}
            cy={16}
            r={12}
            fill={color}
            animatedProps={firstDotProps}
          />
          <AnimatedCircle
            cx={48}
            cy={16}
            r={12}
            fill={color}
            animatedProps={secondDotProps}
          />
        </G>
      </Svg>
    </View>
  );
}
