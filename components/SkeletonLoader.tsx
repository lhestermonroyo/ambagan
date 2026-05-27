import React, { useEffect } from "react";
import { View, useColorScheme } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";

const SKELETON_LIGHT = "#E8E8E8";
const SKELETON_DARK = "#2C2C2C";
const DIVIDER_LIGHT = "#F2F2F2";
const DIVIDER_DARK = "#222222";

function useSkeletonPulse() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.35, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

function Bone({
  w,
  h,
  radius = 6,
  color
}: {
  w: number | `${number}%`;
  h: number;
  radius?: number;
  color: string;
}) {
  return (
    <View
      style={{ width: w, height: h, borderRadius: radius, backgroundColor: color }}
    />
  );
}

function SkeletonDivider({ color }: { color: string }) {
  return (
    <View style={{ marginHorizontal: 16, height: 1, backgroundColor: color }} />
  );
}

// ─────────────────────────────────────────────
// FriendItem / FavoriteListItem skeleton
// Layout: avatar(48) | name + email | amount
// ─────────────────────────────────────────────
function FriendSkeletonRow({ color }: { color: string }) {
  return (
    <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Bone w={48} h={48} radius={999} color={color} />
      <View style={{ flex: 1, gap: 8 }}>
        <Bone w="40%" h={14} color={color} />
        <Bone w="62%" h={12} color={color} />
      </View>
      <Bone w={56} h={14} color={color} />
    </View>
  );
}

export function FriendListSkeleton({ count = 5 }: { count?: number }) {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const divider = scheme === "dark" ? DIVIDER_DARK : DIVIDER_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={animStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <SkeletonDivider color={divider} />}
          <FriendSkeletonRow color={color} />
        </React.Fragment>
      ))}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// FriendCard skeleton (horizontal dashboard cards)
// Layout: bordered card | avatar(32) | name | amount
// ─────────────────────────────────────────────
function FriendCardSkeletonItem({ color }: { color: string }) {
  return (
    <View
      style={{
        minWidth: 160,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: color,
        padding: 16,
        gap: 8
      }}
    >
      <Bone w={32} h={32} radius={999} color={color} />
      <View style={{ gap: 6 }}>
        <Bone w={96} h={14} color={color} />
        <Bone w={64} h={14} color={color} />
      </View>
    </View>
  );
}

export function FriendCardListSkeleton({ count = 3 }: { count?: number }) {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View
      style={[animStyle, { flexDirection: "row", gap: 8, paddingHorizontal: 16 }]}
    >
      {Array.from({ length: count }).map((_, i) => (
        <FriendCardSkeletonItem key={i} color={color} />
      ))}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// GroupItem skeleton
// Layout: avatar(48) | name + date | 2 small avatars
// ─────────────────────────────────────────────
function GroupSkeletonRow({ color }: { color: string }) {
  return (
    <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Bone w={48} h={48} radius={999} color={color} />
      <View style={{ flex: 1, gap: 8 }}>
        <Bone w="50%" h={14} color={color} />
        <Bone w="38%" h={12} color={color} />
      </View>
      <View style={{ flexDirection: "row" }}>
        <Bone w={24} h={24} radius={999} color={color} />
        <Bone w={24} h={24} radius={999} color={color} />
      </View>
    </View>
  );
}

export function GroupListSkeleton({ count = 5 }: { count?: number }) {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const divider = scheme === "dark" ? DIVIDER_DARK : DIVIDER_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={animStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <SkeletonDivider color={divider} />}
          <GroupSkeletonRow color={color} />
        </React.Fragment>
      ))}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// NotificationItem skeleton
// Layout: avatar(48) | message lines + date | dot
// ─────────────────────────────────────────────
function NotificationSkeletonRow({ color }: { color: string }) {
  return (
    <View style={{ padding: 16, flexDirection: "row", gap: 8 }}>
      <Bone w={48} h={48} radius={999} color={color} />
      <View style={{ flex: 1, gap: 8 }}>
        <Bone w="90%" h={14} color={color} />
        <Bone w="70%" h={14} color={color} />
        <Bone w={80} h={12} color={color} />
      </View>
    </View>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const divider = scheme === "dark" ? DIVIDER_DARK : DIVIDER_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={animStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <SkeletonDivider color={divider} />}
          <NotificationSkeletonRow color={color} />
        </React.Fragment>
      ))}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// SettlementItem skeleton
// Layout: circle icon(32) | description+date / member pays payer / amount+badge
// ─────────────────────────────────────────────
function SettlementSkeletonRow({ color }: { color: string }) {
  return (
    <View style={{ padding: 16, flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <Bone w={32} h={32} radius={999} color={color} />
      <View style={{ flex: 1, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Bone w="55%" h={12} color={color} />
          <Bone w={64} h={12} color={color} />
        </View>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Bone w={112} h={16} color={color} />
            <Bone w={32} h={12} color={color} />
            <Bone w={96} h={16} color={color} />
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <Bone w={80} h={16} color={color} />
            <Bone w={64} h={20} radius={999} color={color} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function SettlementListSkeleton({ count = 4 }: { count?: number }) {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const divider = scheme === "dark" ? DIVIDER_DARK : DIVIDER_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={animStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <SkeletonDivider color={divider} />}
          <SettlementSkeletonRow color={color} />
        </React.Fragment>
      ))}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// ExpenseItem skeleton
// Layout: description + "paid by" avatars | amount
// ─────────────────────────────────────────────
function ExpenseSkeletonRow({ color }: { color: string }) {
  return (
    <View
      style={{
        padding: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8
      }}
    >
      <View style={{ flex: 1, gap: 8 }}>
        <Bone w="65%" h={16} color={color} />
        <Bone w={112} h={12} color={color} />
      </View>
      <Bone w={80} h={16} color={color} />
    </View>
  );
}

export function ExpenseListSkeleton({ count = 5 }: { count?: number }) {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const divider = scheme === "dark" ? DIVIDER_DARK : DIVIDER_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={animStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && <SkeletonDivider color={divider} />}
          <ExpenseSkeletonRow color={color} />
        </React.Fragment>
      ))}
    </Animated.View>
  );
}
