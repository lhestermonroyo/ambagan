import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import {
  CircleUserRound,
  HouseHeart,
  UsersRound,
  Wallet
} from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Platform, Pressable, Text, View, useColorScheme } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PILL_WIDTH = 88;
const TAB_HEIGHT = 60;
const BAR_PADDING_H = 16;

const ICONS: Record<string, (color: string) => React.ReactElement | null> = {
  index: (color) => <Wallet size={22} color={color} />,
  groups: (color) => <HouseHeart size={22} color={color} />,
  friends: (color) => <UsersRound size={22} color={color} />,
  profile: (color) => <CircleUserRound size={22} color={color} />
};

const LABELS: Record<string, string> = {
  index: "Overview",
  groups: "Groups",
  friends: "Friends",
  profile: "Profile"
};

export default function CustomTabBar({
  state,
  descriptors,
  navigation
}: BottomTabBarProps) {
  const colorScheme = useColorScheme() ?? "light";
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === "dark";

  const barWidthRef = useRef(0);
  const isFirstLayout = useRef(true);
  const pillX = useSharedValue(-PILL_WIDTH);

  const barBg = isDark
    ? getSecondaryHex("text-secondary-100", colorScheme)
    : getSecondaryHex("text-secondary-0", colorScheme);
  const pillColor = getPrimaryHex("text-primary-600", colorScheme);
  const activeColor = getSecondaryHex("text-secondary-0", colorScheme);
  const inactiveColor = getPrimaryHex("text-primary-400", colorScheme);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }]
  }));

  useEffect(() => {
    const bw = barWidthRef.current;
    if (bw === 0) return;
    const tabW = bw / state.routes.length;
    const targetX = state.index * tabW + (tabW - PILL_WIDTH) / 2;
    pillX.value = withSpring(targetX, {
      damping: 18,
      stiffness: 200,
      mass: 0.7
    });
  }, [state.index, state.routes.length]);

  return (
    <View
      style={{
        backgroundColor: barBg,
        paddingBottom: insets.bottom > 0 ? insets.bottom - 10 : 20,
        paddingTop: 10,
        paddingHorizontal: BAR_PADDING_H,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 8,
        elevation: 8
      }}
      onLayout={(e) => {
        const newWidth = e.nativeEvent.layout.width - BAR_PADDING_H * 2;
        barWidthRef.current = newWidth;
        const tabW = newWidth / state.routes.length;
        const targetX = state.index * tabW + (tabW - PILL_WIDTH) / 2;
        if (isFirstLayout.current) {
          pillX.value = targetX;
          isFirstLayout.current = false;
        }
      }}
    >
      <View
        style={{
          flexDirection: "row",
          height: TAB_HEIGHT,
          position: "relative"
        }}
      >
        <Animated.View
          style={[
            pillStyle,
            {
              position: "absolute",
              width: PILL_WIDTH,
              height: TAB_HEIGHT,
              borderRadius: 999,
              backgroundColor: pillColor,
              shadowColor: pillColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.45,
              shadowRadius: 12,
              elevation: 4,
              overflow: "hidden"
            }
          ]}
        />

        {/* Tab buttons */}
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const color = isFocused ? activeColor : inactiveColor;
          const icon = ICONS[route.name]?.(color);
          const label = LABELS[route.name] ?? route.name;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true
                });
                if (!isFocused && !event.defaultPrevented) {
                  if (Platform.OS === "ios") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  navigation.navigate(route.name);
                }
              }}
              onLongPress={() => {
                navigation.emit({ type: "tabLongPress", target: route.key });
              }}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                zIndex: 1
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={
                descriptors[route.key].options.tabBarAccessibilityLabel
              }
            >
              {icon}
              <Text
                style={{
                  color,
                  fontSize: 11,
                  fontWeight: isFocused ? "600" : "400"
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
