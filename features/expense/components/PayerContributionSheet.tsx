import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import KeyboardAvoidingSheet from "@/components/KeyboardAvoidingSheet";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useBanner } from "@/hooks/useBanner";
import states from "@/states";
import { Member } from "@/types/groups";
import { useEffect, useMemo, useState } from "react";
import PayersContributionStep from "./PayersContributionStep";

type Payers = Record<string, { amount: string }>;

type PayerContributionSheetProps = {
  isOpen: boolean;
  members: Member[];
  /** The expense total, as the raw input string, so we can validate that the
   * contributions add up to it. */
  amount: string;
  currency: string;
  /** The currently committed payers on the form; edits here are local until
   * "Save Changes" so a back-out/dismiss discards them. */
  payers: Payers;
  isLockedGroup?: boolean;
  groupName?: string;
  onClose: () => void;
  onDone: (payers: Payers) => void;
};

/**
 * Fullscreen sheet that reuses the "Who paid?" step so Add Expense can split a
 * payment across multiple payers without a separate form. Holds a
 * local draft, validates that contributions sum to the total, and only commits
 * on "Save Changes" — backing out keeps the form's existing payers untouched.
 */
export default function PayerContributionSheet({
  isOpen,
  members,
  amount,
  currency,
  payers,
  isLockedGroup = false,
  groupName,
  onClose,
  onDone
}: PayerContributionSheetProps) {
  const { details: currentUser } = states.user();
  const { sheetTopInset } = useBanner();
  const [draft, setDraft] = useState<Payers>(payers);

  // Seed the draft each time the sheet opens: adopt the committed payers if any
  // were set, otherwise default to "you paid the whole thing" so the list opens
  // on a sensible single-payer state.
  useEffect(() => {
    if (!isOpen) return;
    const hasActive = Object.values(payers).some(
      (p) => parseFloat(p.amount) > 0
    );
    const next: Payers = hasActive
      ? payers
      : currentUser?.id
        ? { [currentUser.id]: { amount: amount || "" } }
        : {};
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAmountChange = (userId: string, value: string) => {
    setDraft((prev) => ({ ...prev, [userId]: { amount: value } }));
  };

  const { valid } = useMemo(() => {
    const total = parseFloat(amount) || 0;
    const values = Object.values(draft);
    const sum = values.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const activeCount = values.filter((p) => parseFloat(p.amount) > 0).length;
    return {
      valid: total > 0 && activeCount >= 1 && Math.abs(sum - total) < 0.01
    };
  }, [draft, amount]);

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[100]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <KeyboardAvoidingSheet>
          <VStack
            className="w-full flex-1"
            style={{ paddingTop: sheetTopInset }}
          >
            <Pressable onPress={onClose}>
              <HStack className="items-center pt-4 px-4">
                <Icon as="arrow-back-ios" className="text-secondary-950" />
                <Text bold className="text-xl">
                  Set Expense Payers
                </Text>
              </HStack>
            </Pressable>
            <Text className="text-sm text-secondary-950 px-4 pt-1 pb-2">
              Enter how much each person contributed to the expense.
            </Text>

            <PayersContributionStep
              step={2}
              showStepper={false}
              showHeader={false}
              amount={amount}
              currency={currency}
              members={members}
              payers={draft}
              onPayerAmountChange={handleAmountChange}
              isLockedGroup={isLockedGroup}
              groupName={groupName}
            />
          </VStack>

          <Box className="items-center justify-center p-4">
            <HStack className="gap-x-2">
              <FormButton
                className="flex-1"
                text="Save Changes"
                disabled={!valid}
                onPress={() => onDone(draft)}
              />
            </HStack>
          </Box>
        </KeyboardAvoidingSheet>
      </ActionsheetContent>
    </Actionsheet>
  );
}
