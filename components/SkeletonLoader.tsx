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
// Expense form field skeletons
// Shown for the group + payer fields (and the whole first step) while the
// group's members are still being fetched, so the entry points can stay
// instant while only the data-dependent fields load.
// ─────────────────────────────────────────────

// Mirrors the Payer field: bordered box | avatar(40) + name/subtitle | chevron.
export function PayerFieldSkeleton() {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View
      style={[
        animStyle,
        { borderWidth: 1, borderColor: color, borderRadius: 8, padding: 16 }
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Bone w={40} h={40} radius={999} color={color} />
        <View style={{ flex: 1, gap: 8 }}>
          <Bone w="45%" h={16} color={color} />
          <Bone w="30%" h={12} color={color} />
        </View>
        <Bone w={18} h={18} color={color} />
      </View>
    </Animated.View>
  );
}

// Mirrors the group member card: name + overlapping avatars + member count |
// per-person amount.
export function GroupCardSkeleton() {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View
      style={[
        animStyle,
        { borderWidth: 1, borderColor: color, borderRadius: 8, padding: 16 }
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Bone w="55%" h={12} color={color} />
          <View style={{ flexDirection: "row" }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Bone w={24} h={24} radius={999} color={color} />
              </View>
            ))}
          </View>
          <Bone w={64} h={12} color={color} />
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Bone w={72} h={24} color={color} />
          <Bone w={32} h={12} color={color} />
        </View>
      </View>
    </Animated.View>
  );
}

// Mirrors the custom-expense first step (header + amount / description / date /
// group / proof fields) while the default group is still being resolved.
export function ExpenseFormStepSkeleton() {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const animStyle = useSkeletonPulse();

  const Field = ({ labelW, h = 48 }: { labelW: number; h?: number }) => (
    <View style={{ gap: 8 }}>
      <Bone w={labelW} h={12} color={color} />
      <Bone w="100%" h={h} radius={8} color={color} />
    </View>
  );

  return (
    <Animated.View style={[animStyle, { padding: 16, gap: 24 }]}>
      <View style={{ gap: 8 }}>
        <Bone w={160} h={22} color={color} />
        <Bone w={200} h={12} color={color} />
      </View>
      <Field labelW={64} />
      <Field labelW={88} h={80} />
      <Field labelW={96} />
      <Field labelW={56} />
      <Field labelW={180} h={120} />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Personal (book) expense form skeletons
// The destination book is fetched on mount — the routed one when the form is
// locked, the most recent one otherwise — and in edit mode every field is
// hydrated from the expense being loaded.
// ─────────────────────────────────────────────

// Mirrors the Book field: label + bordered row with avatar(24) + book name.
function BookFieldBones({ color }: { color: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Bone w={40} h={12} color={color} />
      <View
        style={{
          height: 56,
          borderWidth: 1,
          borderColor: color,
          borderRadius: 8,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12
        }}
      >
        <Bone w={24} h={24} radius={999} color={color} />
        <Bone w="45%" h={16} color={color} />
      </View>
    </View>
  );
}

export function BookFieldSkeleton() {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={animStyle}>
      <BookFieldBones color={color} />
    </Animated.View>
  );
}

// Mirrors the whole personal expense form — amount (currency + input),
// description, book, and the collapsed More options chip row — for edit mode,
// where every field is hydrated from the expense being loaded.
export function PersonalExpenseFormSkeleton() {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={[animStyle, { gap: 24 }]}>
      {/* Amount: currency selector + input, both h-14 */}
      <View style={{ gap: 8 }}>
        <Bone w={56} h={12} color={color} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Bone w={88} h={56} radius={8} color={color} />
          <View style={{ flex: 1 }}>
            <Bone w="100%" h={56} radius={8} color={color} />
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={{ gap: 8 }}>
        <Bone w={80} h={12} color={color} />
        <Bone w="100%" h={80} radius={8} color={color} />
      </View>

      <BookFieldBones color={color} />

      {/* Collapsed chip row + expand toggle */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {[96, 80, 72].map((w) => (
          <Bone key={w} w={w} h={36} radius={999} color={color} />
        ))}
        <View style={{ flex: 1 }} />
        <Bone w={36} h={36} radius={999} color={color} />
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Header action skeleton
// Icon-sized bone(s) shown in place of header action buttons whose behavior
// depends on the record still being fetched (e.g. the group-details leave /
// menu icons), so they can't be tapped before the data is ready.
// ─────────────────────────────────────────────
export function HeaderActionSkeleton({ count = 1 }: { count?: number }) {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={[animStyle, { flexDirection: "row", gap: 24 }]}>
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} w={24} h={24} radius={999} color={color} />
      ))}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// FriendRow skeleton
// Layout: avatar(48) | name + email | amount + heart + chevron
// ─────────────────────────────────────────────
function FriendSkeletonRow({ color }: { color: string }) {
  return (
    <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Bone w={48} h={48} radius={999} color={color} />
      <View style={{ flex: 1, gap: 8 }}>
        <Bone w="40%" h={14} color={color} />
        <Bone w="62%" h={12} color={color} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Bone w={56} h={14} color={color} />
        <Bone w={18} h={18} radius={999} color={color} />
        <Bone w={8} h={14} color={color} />
      </View>
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
// Overview action buttons skeleton
// Sits on the purple hero, so bones are white-tinted (independent of scheme).
// Layout: N columns of circle(56) + label line — mirrors the ActionButton row.
// Shown on the initial load so the buttons aren't tappable before groups (and
// the expense forms' default group) have finished fetching.
// ─────────────────────────────────────────────
export function ActionButtonsSkeleton({ count = 4 }: { count?: number }) {
  const animStyle = useSkeletonPulse();
  const color = "rgba(255,255,255,0.3)";

  return (
    <Animated.View style={animStyle}>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
        {Array.from({ length: count }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 16
            }}
          >
            <Bone w={56} h={56} radius={999} color={color} />
            <Bone w="70%" h={10} radius={4} color={color} />
          </View>
        ))}
      </View>
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
// AnalyticsScreen skeleton
// Overview card + Spending by Group + Monthly Trend + Top Partners
// ─────────────────────────────────────────────
export function AnalyticsSkeleton() {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const divider = scheme === "dark" ? DIVIDER_DARK : DIVIDER_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={[animStyle, { padding: 16, gap: 24 }]}>
      {/* Overview card */}
      <View
        style={{
          backgroundColor: color,
          borderRadius: 16,
          padding: 16,
          gap: 16
        }}
      >
        <Bone w={72} h={12} color={divider} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Bone w={48} h={32} color={divider} />
          <Bone w={72} h={14} color={divider} />
        </View>
        <View style={{ height: 1, backgroundColor: divider }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Bone w={72} h={14} color={divider} />
          <Bone w={96} h={18} color={divider} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Bone w={64} h={14} color={divider} />
          <Bone w={96} h={18} color={divider} />
        </View>
      </View>

      {/* Spending by Group */}
      <View style={{ gap: 10 }}>
        <Bone w={180} h={22} color={color} />
        <View
          style={{ backgroundColor: color, borderRadius: 16, padding: 24, gap: 20 }}
        >
          {[0.85, 0.6, 0.4, 0.25].map((pct, i) => (
            <View key={i} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Bone w="50%" h={14} color={divider} />
                <Bone w={80} h={14} color={divider} />
              </View>
              <View
                style={{
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: divider,
                  overflow: "hidden"
                }}
              >
                <View
                  style={{
                    width: `${pct * 100}%`,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: color
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Monthly Trend */}
      <View style={{ gap: 10 }}>
        <Bone w={148} h={22} color={color} />
        <View
          style={{
            backgroundColor: color,
            borderRadius: 16,
            padding: 16
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 6,
              height: 96
            }}
          >
            {[0.3, 0.6, 0.45, 0.8, 0.55, 1.0, 0.7, 0.4, 0.65, 0.5, 0.75, 0.35].map(
              (h, i) => (
                <View
                  key={i}
                  style={{ flex: 1, alignItems: "center", gap: 4, justifyContent: "flex-end" }}
                >
                  <View
                    style={{
                      width: "100%",
                      height: Math.max(h * 72, 4),
                      borderRadius: 4,
                      backgroundColor: divider
                    }}
                  />
                  <Bone w={16} h={8} color={divider} />
                </View>
              )
            )}
          </View>
        </View>
      </View>

      {/* Top Split Partners */}
      <View style={{ gap: 10 }}>
        <Bone w={180} h={22} color={color} />
        <View style={{ backgroundColor: color, borderRadius: 16, overflow: "hidden" }}>
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <View style={{ height: 1, backgroundColor: divider, marginHorizontal: 16 }} />
              )}
              <View
                style={{
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12
                }}
              >
                <Bone w={40} h={40} radius={999} color={divider} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Bone w="50%" h={14} color={divider} />
                  <Bone w="35%" h={12} color={divider} />
                </View>
                <Bone w={36} h={24} radius={999} color={divider} />
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// SubscriptionPlanSkeleton
// 3 plan selection cards
// ─────────────────────────────────────────────
export function SubscriptionPlanSkeleton() {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const divider = scheme === "dark" ? DIVIDER_DARK : DIVIDER_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={[animStyle, { gap: 8 }]}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: color,
            borderRadius: 16,
            padding: 16
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View style={{ gap: 6, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Bone w={80} h={18} color={divider} />
                {i === 2 && <Bone w={56} h={20} radius={999} color={divider} />}
              </View>
              <Bone w={140} h={12} color={divider} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Bone w={72} h={20} color={divider} />
              <Bone w={20} h={20} radius={999} color={divider} />
            </View>
          </View>
        </View>
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

// ─────────────────────────────────────────────
// ExpenseDetailsScreen skeleton
// Header (description + amount) + detail card (4 rows) + Payers / Member Splits
// ─────────────────────────────────────────────
function ExpenseDetailRowSkeleton({
  color,
  valueW,
  withAvatar = false
}: {
  color: string;
  valueW: number;
  withAvatar?: boolean;
}) {
  return (
    <View
      style={{
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8
      }}
    >
      <Bone w={104} h={14} color={color} />
      {withAvatar ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Bone w={24} h={24} radius={999} color={color} />
          <Bone w={valueW} h={14} color={color} />
        </View>
      ) : (
        <Bone w={valueW} h={14} color={color} />
      )}
    </View>
  );
}

// Payer / Member-split row: avatar(40) | name + subtitle | amount
function ExpensePersonRowSkeleton({ color }: { color: string }) {
  return (
    <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Bone w={40} h={40} radius={999} color={color} />
      <View style={{ flex: 1, gap: 6 }}>
        <Bone w="50%" h={16} color={color} />
        <Bone w="35%" h={12} color={color} />
      </View>
      <Bone w={72} h={16} color={color} />
    </View>
  );
}

export function ExpenseDetailsSkeleton() {
  const scheme = useColorScheme() ?? "light";
  const color = scheme === "dark" ? SKELETON_DARK : SKELETON_LIGHT;
  const divider = scheme === "dark" ? DIVIDER_DARK : DIVIDER_LIGHT;
  const animStyle = useSkeletonPulse();

  return (
    <Animated.View style={[animStyle, { paddingVertical: 16, gap: 24 }]}>
      {/* Header: description + amount */}
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <Bone w={120} h={12} color={color} />
        <Bone w={168} h={30} color={color} />
      </View>

      {/* Detail card: Expense Date / Created By / Split Type / Proof of Payment */}
      <View
        style={{
          marginHorizontal: 16,
          borderRadius: 12,
          backgroundColor: color,
          overflow: "hidden"
        }}
      >
        <ExpenseDetailRowSkeleton color={divider} valueW={110} />
        <View style={{ height: 1, backgroundColor: divider, marginHorizontal: 16 }} />
        <ExpenseDetailRowSkeleton color={divider} valueW={120} withAvatar />
        <View style={{ height: 1, backgroundColor: divider, marginHorizontal: 16 }} />
        <ExpenseDetailRowSkeleton color={divider} valueW={72} />
        <View style={{ height: 1, backgroundColor: divider, marginHorizontal: 16 }} />
        <ExpenseDetailRowSkeleton color={divider} valueW={96} />
      </View>

      {/* Payers */}
      <View style={{ gap: 8 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <Bone w={80} h={20} color={color} />
        </View>
        {[0, 1].map((i) => (
          <React.Fragment key={i}>
            {i > 0 && <SkeletonDivider color={divider} />}
            <ExpensePersonRowSkeleton color={color} />
          </React.Fragment>
        ))}
      </View>

      {/* Member Splits */}
      <View style={{ gap: 8 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <Bone w={128} h={20} color={color} />
        </View>
        {[0, 1, 2].map((i) => (
          <React.Fragment key={i}>
            {i > 0 && <SkeletonDivider color={divider} />}
            <ExpensePersonRowSkeleton color={color} />
          </React.Fragment>
        ))}
      </View>
    </Animated.View>
  );
}
