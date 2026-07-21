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
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { cn } from "@gluestack-ui/utils/nativewind-utils";

export default function SettlementItem({
  item,
  onPress,
  highlighted = false
}: {
  item: PaymentPreview | Payment;
  // Omit onPress for a display-only row — no press feedback and no chevron.
  // Used by confirmation lists (delete/leave) and the settlement summary sheet.
  onPress?: (payment: PaymentPreview | Payment) => void;
  // Tints the row to draw the eye to it — used when deep-linked from a
  // notification so the referenced settlement is unmistakable.
  highlighted?: boolean;
}) {
  const { details: userDetails, settlementView } = states.user();

  const isUserPayer = item.payer.id === userDetails?.id;
  const isUserMember = item.member.id === userDetails?.id;
  const pressable = !!onPress;

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
      className={cn("text-lg", isUserMember ? "text-error-400" : undefined)}
    >
      {isUserMember && "-"}
      {formatAmount(item.amount, item.currency)}
    </Text>
  );

  let content: React.ReactNode;

  if (settlementView === "compact") {
    content = (
      <HStack className="gap-x-3 items-start">
        <SettlementAvatar isPayer={isUserPayer} />
        <VStack className="flex-1 gap-y-2">
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
            <Text className="text-lg flex-1" numberOfLines={1}>
              <Text className={cn("text-lg", isUserMember && "font-medium")}>
                {memberLabel}
              </Text>{" "}
              {isUserMember ? "pay" : "pays"}{" "}
              <Text className={cn("text-lg", isUserPayer && "font-medium")}>
                {payerLabel}
              </Text>
            </Text>
            <Text
              className={cn(
                "text-lg",
                isUserMember ? "text-error-400" : undefined
              )}
            >
              {isUserMember && "-"}
              {formatAmount(item.amount, item.currency)}
            </Text>
            <StatusBadge status={item.status} iconOnly />
            {pressable && (
              <Icon as="chevron-right" className="text-secondary-950" />
            )}
          </HStack>
        </VStack>
      </HStack>
    );
  } else if (settlementView === "arrow") {
    content = (
      <HStack className="gap-x-3 items-start">
        <SettlementAvatar isPayer={isUserPayer} />
        <VStack className="flex-1 gap-y-2">
          {header}
          <HStack className="gap-x-2 items-center">
            <HStack className="flex-1 items-center gap-x-2">
              <Text
                className={cn(
                  "text-lg shrink",
                  isUserMember && "font-medium"
                )}
                numberOfLines={1}
              >
                {memberName}
              </Text>
              <Icon as="arrow-right-alt" className="text-secondary-950" />
              <Text
                className={cn(
                  "text-lg shrink",
                  isUserPayer && "font-medium"
                )}
                numberOfLines={1}
              >
                {payerName}
              </Text>
            </HStack>
            {amount}
            <StatusBadge status={item.status} iconOnly />
            {pressable && (
              <Icon as="chevron-right" className="text-secondary-950" />
            )}
          </HStack>
        </VStack>
      </HStack>
    );
  } else {
    // "full" (default)
    content = (
      <HStack className="gap-x-2 items-start">
        <SettlementAvatar isPayer={isUserPayer} />
        <VStack className="gap-y-2 flex-1">
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
            <VStack className="flex-1">
              <HStack className="items-center gap-x-1">
                <Text className={cn("text-lg", isUserMember && "font-medium")}>
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
                <Text className={cn("text-lg", isUserPayer && "font-medium")}>
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
            <HStack className="gap-x-2 items-center">
              <VStack className="items-end">
                <Text
                  className={cn(
                    "text-lg",
                    isUserMember ? "text-error-400" : undefined
                  )}
                >
                  {isUserMember && "-"}
                  {formatAmount(item.amount, item.currency)}
                </Text>
                <StatusBadge status={item.status} size="md" />
              </VStack>
              {pressable && (
                <Icon as="chevron-right" className="text-secondary-950" />
              )}
            </HStack>
          </HStack>
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
