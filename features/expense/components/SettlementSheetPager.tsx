import { type ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Easing, useWindowDimensions, View } from "react-native";

/** Two pages in one mounted sheet: push left into the form, pop right to history. */
export default function SettlementSheetPager({ recording, details, form }: {
  recording: boolean;
  details: ReactNode;
  form: ReactNode;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const width = measuredWidth ?? windowWidth;
  const [progress] = useState(() => new Animated.Value(recording ? 1 : 0));
  const previousPage = useRef(recording);

  useEffect(() => {
    // The sheet owns its opening animation. Only slide on an actual page change.
    if (previousPage.current === recording) return;
    previousPage.current = recording;
    const animation = Animated.timing(progress, {
      toValue: recording ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [recording, progress]);

  return (
    <View style={{ flex: 1, overflow: "hidden" }} onLayout={(event) => {
      const measured = event.nativeEvent.layout.width;
      if (measured > 0) setMeasuredWidth(measured);
    }}>
        <Animated.View style={{ flex: 1, flexDirection: "row", width: width * 2,
          transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) }] }}>
          <View style={{ width }} pointerEvents={recording ? "none" : "auto"}
            accessibilityElementsHidden={recording} importantForAccessibility={recording ? "no-hide-descendants" : "auto"}>
            {details}
          </View>
          <View style={{ width }} pointerEvents={recording ? "auto" : "none"}
            accessibilityElementsHidden={!recording} importantForAccessibility={recording ? "auto" : "no-hide-descendants"}>
            {form}
          </View>
        </Animated.View>
    </View>
  );
}
