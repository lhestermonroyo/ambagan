import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import services from "@/services";
import states from "@/states";
import {
  Expense,
  ExpensePayer,
  MemberSplit,
  Payment,
  SplitType
} from "@/types/expenses";
import { getSecondaryHex } from "@/utils/getColorHex";
import { ChevronDown } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { formatAmount } from "../utils/formatAmount";

const transition = {
  duration: 280,
  easing: Easing.inOut(Easing.cubic),
  reduceMotion: ReduceMotion.System
};

type BreakdownData = {
  expense: Expense;
  memberSplits: MemberSplit[];
  payers: ExpensePayer[];
};

/**
 * Collapsible card that explains how a settlement amount was derived. Lazy-loads
 * the expense's total, split type, payer contributions and member shares on
 * first expand (the Payment alone doesn't carry them). Shared by the settlement
 * sheets so both parties can see the same computation.
 */
export default function SettlementBreakdown({
  payment
}: {
  payment: Payment;
}) {
  const { details: userDetails } = states.user();
  const colorScheme = useColorScheme() ?? "light";

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [data, setData] = useState<BreakdownData | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const height = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    // Measure independently of the clipped container. Animate again when the
    // loading row is replaced by the full computation or an error message.
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

  const loadBreakdown = async () => {
    setLoading(true);
    setError(false);
    try {
      const [expense, memberSplits, payers] = await Promise.all([
        services.expense.getExpenseById(payment.expense_id),
        services.expense.getMemberSplitsByExpenseId(payment.expense_id),
        services.expense.getPayersByExpenseId(payment.expense_id)
      ]);
      setData({ expense, memberSplits, payers });
    } catch (e) {
      console.error("Error loading settlement breakdown:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    // Fetch once, on first expand.
    if (next && !data && !loading) {
      void loadBreakdown();
    }
  };

  const isMember = payment.member.id === userDetails?.id;
  const isPayer = payment.payer.id === userDetails?.id;

  const memberSplit =
    data?.memberSplits.find((m) => m.member.id === payment.member.id) ?? null;
  const memberShare = memberSplit?.amount ?? null;
  const memberPct = memberSplit?.percentage ?? null;
  const payerPaid =
    data?.payers.find((p) => p.payer.id === payment.payer.id)?.amount ?? null;
  const peopleCount = data?.memberSplits.length ?? 0;

  const splitLabel = (() => {
    if (!data) return "";
    switch (data.expense.split_type) {
      case SplitType.EQUAL:
        return `Equal • ${peopleCount} people`;
      case SplitType.PERCENTAGE:
        return "Percentage";
      case SplitType.CUSTOM:
        return "Custom";
      default:
        return data.expense.split_type;
    }
  })();

  const payerPaidLabel = isPayer
    ? "You paid"
    : `${payment.payer.first_name} paid`;
  const memberShareLabel = isMember
    ? "Your share"
    : `${payment.member.first_name}'s share`;
  const settlementLabel = isMember
    ? `You pay ${payment.payer.first_name}`
    : isPayer
      ? `You receive from ${payment.member.first_name}`
      : `${payment.member.first_name} → ${payment.payer.first_name}`;

  // With multiple payers, or when the member also paid, netting can split a
  // member's share across settlements — so the transfer may differ from the
  // raw share. Only footnote it when they actually diverge.
  const shareDiffers =
    memberShare != null && Math.abs(memberShare - payment.amount) > 0.01;

  const iconColor = getSecondaryHex("text-secondary-950", colorScheme);

  return (
    <Box className="bg-secondary-100 rounded-xl overflow-hidden">
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <HStack className="items-center justify-between p-4">
          <Text bold className="text-secondary-950">
            Breakdown of computation
          </Text>
          <Animated.View style={chevronStyle}>
            <ChevronDown size={20} color={iconColor} />
          </Animated.View>
        </HStack>
      </Pressable>

      <Animated.View
        style={contentStyle}
        pointerEvents={expanded ? "auto" : "none"}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
      >
        <VStack
          style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
        >
          <Box className="mx-4">
            <Divider className="border-secondary-200" />
          </Box>
          {loading ? (
            <HStack className="p-4 gap-x-2 items-center">
              <ActivityIndicator color={iconColor} />
              <Text className="text-sm text-secondary-950">
                Loading breakdown…
              </Text>
            </HStack>
          ) : error ? (
            <VStack className="p-4 gap-y-2">
              <Text className="text-sm text-secondary-950">
                Couldn&apos;t load the breakdown. Check your connection and try
                again.
              </Text>
              <Pressable onPress={loadBreakdown}>
                <Text bold className="text-sm text-primary-500">
                  Retry
                </Text>
              </Pressable>
            </VStack>
          ) : data ? (
            <VStack className="px-4 py-2">
              <BreakdownRow
                label="Total expense"
                value={formatAmount(data.expense.amount, payment.currency)}
              />
              <BreakdownRow label="Split" value={splitLabel} />
              {payerPaid != null && (
                <BreakdownRow
                  label={payerPaidLabel}
                  value={formatAmount(payerPaid, payment.currency)}
                />
              )}
              {memberShare != null && (
                <BreakdownRow
                  label={memberShareLabel}
                  value={
                    memberPct != null &&
                    data.expense.split_type === SplitType.PERCENTAGE
                      ? `${formatAmount(memberShare, payment.currency)} (${memberPct}%)`
                      : formatAmount(memberShare, payment.currency)
                  }
                />
              )}
              <Box className="my-1">
                <Divider className="border-secondary-200" />
              </Box>
              <BreakdownRow
                label={settlementLabel}
                value={formatAmount(payment.amount, payment.currency)}
                emphasize
              />
              {shareDiffers && (
                <Text className="text-xs text-secondary-950 pt-2">
                  This settles part of the balance after accounting for who paid
                  what.
                </Text>
              )}
            </VStack>
          ) : null}
        </VStack>
      </Animated.View>
    </Box>
  );
}

function BreakdownRow({
  label,
  value,
  emphasize = false
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <HStack className="items-center justify-between py-2 gap-x-4">
      <Text
        className={emphasize ? "font-semibold flex-1" : "text-secondary-950 flex-1"}
      >
        {label}
      </Text>
      <Text className={emphasize ? "text-lg" : ""} bold={emphasize}>
        {value}
      </Text>
    </HStack>
  );
}
