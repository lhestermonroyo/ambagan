import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import StatusBadge from "@/features/expense/components/StatusBadge";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { getSettlementDateLabel } from "@/features/expense/utils/settlementDate.util";
import useUserState from "@/features/user/states/user.state";
import { Payment, PaymentPreview } from "@/types/expenses";
import { SettlementView } from "@/types/user";
import { cn } from "@gluestack-ui/utils/nativewind-utils";

export default function SettlementItem({
  item,
  onPress,
  highlighted = false,
  confirmedPaidAmount,
  view
}: {
  item: PaymentPreview | Payment;
  // Omit onPress for a display-only row — no press feedback and no chevron.
  // Used by confirmation lists (delete/leave) and the settlement summary sheet.
  onPress?: (payment: PaymentPreview | Payment) => void;
  // Tints the row to draw the eye to it — used when deep-linked from a
  // notification so the referenced settlement is unmistakable.
  highlighted?: boolean;
  // Optional display override. Live rows use item.confirmed_paid_amount;
  // item.amount always stays the original debt.
  confirmedPaidAmount?: number;
  // Used by the example in the Settlement View picker.
  view?: SettlementView;
}) {
  const userDetails = useUserState((state) => state.details);
  const preferredView = useUserState((state) => state.settlementView);
  const settlementView = view ?? preferredView;

  const isUserPayer = item.payer.id === userDetails?.id;
  const isUserMember = item.member.id === userDetails?.id;
  const pressable = !!onPress;
  const paidAmount = confirmedPaidAmount ?? item.confirmed_paid_amount ?? 0;
  const isPartiallyPaid =
    item.status !== "settled" &&
    Number.isFinite(item.amount) &&
    Number.isFinite(paidAmount) &&
    paidAmount > 0 &&
    paidAmount < item.amount;
  const remainingAmount = isPartiallyPaid
    ? item.amount - paidAmount
    : item.amount;
  // A new request can be awaiting review on an already partially paid item.
  // Preserve that actionable status instead of hiding it behind payment progress.
  const displayStatus =
    isPartiallyPaid && item.status === "pending"
      ? "partially_paid"
      : item.status;
  const paidSummary = isPartiallyPaid
    ? `${formatAmount(paidAmount, item.currency)} of ${formatAmount(item.amount, item.currency)} paid`
    : null;

  // "You" when the current user is that party, otherwise their first name.
  const memberLabel = isUserMember ? "You" : `${item.member.first_name}`;
  const payerLabel = isUserPayer ? "You" : `${item.payer.first_name}`;

  // First name with a "(You)" marker — used by the arrow views where the
  // subject/object are shown as names rather than folded into a sentence.
  const memberName = `${item.member.first_name}${isUserMember ? " (You)" : ""}`;
  const payerName = `${item.payer.first_name}${isUserPayer ? " (You)" : ""}`;

  // Description + date header shared by the compact-style views.
  const header = item.expense_description ? (
    <HStack className="gap-x-2 items-center">
      <Text
        className="text-sm text-secondary-950 uppercase flex-1"
        bold
        numberOfLines={1}
      >
        {item.expense_description}
      </Text>
      <HStack className="gap-x-1 items-center">
        {item.pending && (
          <Icon as="sync" size={12} className="text-primary-400" />
        )}
        <Text className="text-sm text-secondary-950">
          {getSettlementDateLabel(item)}
        </Text>
      </HStack>
    </HStack>
  ) : null;

  const amount = (
    <Text
      className={cn(
        "text-lg font-medium",
        isUserMember ? "text-error-400" : undefined
      )}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {isUserMember && "-"}
      {formatAmount(remainingAmount, item.currency)}
      {isPartiallyPaid && (
        <Text className="text-sm text-secondary-950"> left</Text>
      )}
    </Text>
  );

  const paymentProgress = paidSummary ? (
    <VStack className="gap-y-2">
      <Text className="text-sm text-secondary-950">{paidSummary}</Text>
      <Box
        className="h-1 rounded-full bg-secondary-200 overflow-hidden"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Confirmed payment progress"
        accessibilityValue={{
          min: 0,
          max: item.amount,
          now: paidAmount,
          text: paidSummary
        }}
      >
        <Box
          className="h-full rounded-full bg-primary-500"
          style={{ width: `${(paidAmount / item.amount) * 100}%` }}
        />
      </Box>
    </VStack>
  ) : null;

  let content: React.ReactNode;

  if (settlementView === "compact") {
    content = (
      <HStack className="gap-x-3 items-start">
        <SettlementAvatar isPayer={isUserPayer} />
        <VStack className="flex-1 min-w-0 gap-y-2">
          <HStack className="gap-x-2 items-center">
            <Text
              className="text-sm text-secondary-950 uppercase flex-1"
              bold
              numberOfLines={1}
            >
              {item.expense_description}
            </Text>
            <HStack className="gap-x-1 items-center">
              {item.pending && (
                <Icon as="sync" size={12} className="text-primary-400" />
              )}
              <Text className="text-sm text-secondary-950">
                {getSettlementDateLabel(item)}
              </Text>
            </HStack>
          </HStack>
          <HStack className="gap-x-2 items-center">
            <Text className="text-lg flex-1 min-w-0" numberOfLines={1}>
              {memberLabel} {isUserMember ? "pay" : "pays"} {payerLabel}
            </Text>
            {amount}
            <StatusBadge status={displayStatus} iconOnly />
            {pressable && (
              <Icon as="chevron-right" className="text-secondary-950" />
            )}
          </HStack>
          {paymentProgress}
        </VStack>
      </HStack>
    );
  } else if (settlementView === "arrow") {
    content = (
      <HStack className="gap-x-3 items-start">
        <SettlementAvatar isPayer={isUserPayer} />
        <VStack className="flex-1 min-w-0 gap-y-2">
          {header}
          <HStack className="gap-x-2 items-center">
            <HStack className="flex-1 min-w-0 items-center gap-x-2">
              <Text
                className={cn("text-lg shrink", isUserMember && "font-medium")}
                numberOfLines={1}
              >
                {memberName}
              </Text>
              <Icon as="arrow-right-alt" className="text-secondary-950" />
              <Text
                className={cn("text-lg shrink", isUserPayer && "font-medium")}
                numberOfLines={1}
              >
                {payerName}
              </Text>
            </HStack>
            {amount}
            <StatusBadge status={displayStatus} iconOnly />
            {pressable && (
              <Icon as="chevron-right" className="text-secondary-950" />
            )}
          </HStack>
          {paymentProgress}
        </VStack>
      </HStack>
    );
  } else {
    // "full" (default)
    content = (
      <HStack className="gap-x-3 items-start">
        <SettlementAvatar isPayer={isUserPayer} />
        <VStack className="gap-y-2 flex-1 min-w-0">
          {item.expense_description && (
            <HStack className="gap-x-4 items-center">
              <Text
                className="text-sm text-secondary-950 uppercase flex-1"
                bold
                numberOfLines={1}
              >
                {item.expense_description}
              </Text>
              <HStack className="gap-x-1 items-center">
                {item.pending && (
                  <Icon as="sync" size={14} className="text-primary-400" />
                )}
                <Text className="text-sm text-secondary-950">
                  {getSettlementDateLabel(item)}
                </Text>
              </HStack>
            </HStack>
          )}
          <HStack className="gap-x-4">
            <VStack className="flex-1 min-w-0">
              <HStack className="items-center gap-x-1">
                <Text
                  className={cn("text-lg shrink", isUserMember && "font-medium")}
                  numberOfLines={1}
                >
                  {item.member.first_name} {item.member.last_name}
                  {isUserMember && " (You)"}
                </Text>
                {item.member.is_placeholder && (
                  <Icon
                    as="schedule"
                    size={14}
                    className="text-secondary-950"
                  />
                )}
              </HStack>
              <Text className="text-sm text-secondary-950">pays</Text>
              <HStack className="items-center gap-x-1">
                <Text
                  className={cn("text-lg shrink", isUserPayer && "font-medium")}
                  numberOfLines={1}
                >
                  {item.payer.first_name} {item.payer.last_name}
                  {isUserPayer && " (You)"}
                </Text>
                {item.payer.is_placeholder && (
                  <Icon
                    as="schedule"
                    size={14}
                    className="text-secondary-950"
                  />
                )}
              </HStack>
            </VStack>
            <HStack className="gap-x-2 items-center shrink-0">
              <VStack className="items-end gap-y-1">
                {amount}
                <HStack className="self-end">
                  <StatusBadge status={displayStatus} size="md" />
                </HStack>
              </VStack>
              {pressable && (
                <Icon as="chevron-right" className="text-secondary-950" />
              )}
            </HStack>
          </HStack>
          {paymentProgress}
        </VStack>
      </HStack>
    );
  }

  if (!pressable) {
    return (
      <Box className={cn("p-4", highlighted && "bg-background-200")}>
        {content}
      </Box>
    );
  }

  return (
    <PressableListItem
      className={cn("p-4", highlighted && "bg-background-200")}
      onPress={() => onPress!(item)}
    >
      {content}
    </PressableListItem>
  );
}
