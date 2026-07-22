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
import { isPayerOnlySplit } from "@/features/expense/utils/split.util";
import { useBanner } from "@/hooks/useBanner";
import { Member } from "@/types/groups";
import { splitTypes } from "@/utils/constants";
import { useEffect, useMemo, useState } from "react";
import SplitExpenseStep from "./SplitExpenseStep";

type Splits = Record<string, { amount: string; percentage: string }>;
type SplitType = (typeof splitTypes)[number]["value"];

type SplitExpenseSheetProps = {
  isOpen: boolean;
  members: Member[];
  /** The expense total, as the raw input string, for validating percentage /
   * custom splits against it. */
  amount: string;
  currency: string;
  groupId: string;
  /** Committed split map + type on the form; edits here are local until
   * "Save Changes" so a back-out/dismiss discards them. */
  splits: Splits;
  splitType: SplitType;
  /** The expense's effective payer id(s), so we can block a split where a lone
   * payer is also the only person sharing the expense (nothing to settle). */
  payerIds: string[];
  isLockedGroup?: boolean;
  groupName?: string;
  onClose: () => void;
  onDone: (splits: Splits, splitType: SplitType) => void;
};

/**
 * Fullscreen sheet that reuses the "Who owes what?" step so Add Expense can
 * divide the total by equal / percentage / exact amounts (and exclude
 * members) without a separate form. Holds a local draft, validates per mode, and
 * only commits on "Save Changes" — backing out keeps the form's split untouched.
 */
export default function SplitExpenseSheet({
  isOpen,
  members,
  amount,
  currency,
  groupId,
  splits,
  splitType,
  payerIds,
  isLockedGroup = false,
  groupName,
  onClose,
  onDone
}: SplitExpenseSheetProps) {
  const { sheetTopInset } = useBanner();
  const [draftSplits, setDraftSplits] = useState<Splits>(splits);
  const [draftTab, setDraftTab] = useState<SplitType>(splitType);
  // Remount the (semi-uncontrolled) step on each open so its internal tab /
  // excluded state re-seeds cleanly from the committed values.
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setDraftSplits(splits);
    setDraftTab(splitType);
    setRenderKey((k) => k + 1);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // A non-empty committed map means the user already customized the split, so
  // preserve it on open instead of auto-redistributing equally.
  const hasCommitted = Object.keys(splits).length > 0;

  const handleSetSplits = (next: Splits, tab: SplitType) => {
    setDraftSplits(next);
    setDraftTab(tab);
  };

  const { valid } = useMemo(() => {
    const total = parseFloat(amount) || 0;
    const entries = Object.entries(draftSplits);
    const included = entries.filter(
      ([, x]) =>
        (parseFloat(x.amount) || 0) > 0 || (parseFloat(x.percentage) || 0) > 0
    );
    if (total <= 0 || included.length < 1) return { valid: false };
    // A lone payer sharing only with themselves nets to zero — block it (the
    // step surfaces the reason). Only meaningful once the totals otherwise add
    // up, which the per-mode checks below enforce.
    const payerOnly = isPayerOnlySplit(
      payerIds,
      included.map(([id]) => id)
    );
    if (draftTab === "percentage") {
      const sum = included.reduce(
        (s, [, x]) => s + (parseFloat(x.percentage) || 0),
        0
      );
      return { valid: Math.abs(sum - 100) < 0.01 && !payerOnly };
    }
    if (draftTab === "custom") {
      const sum = included.reduce(
        (s, [, x]) => s + (parseFloat(x.amount) || 0),
        0
      );
      return { valid: Math.abs(sum - total) < 0.01 && !payerOnly };
    }
    return { valid: !payerOnly }; // equal auto-distributes, always balanced
  }, [draftSplits, draftTab, amount, payerIds]);

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
                  Edit Expense Split
                </Text>
              </HStack>
            </Pressable>
            <Text className="text-sm text-secondary-950 px-4 pt-1 pb-2">
              Choose how the total is divided among each member.
            </Text>

            {isOpen && (
              <SplitExpenseStep
                key={renderKey}
                step={3}
                showStepper={false}
                showHeader={false}
                amount={amount}
                currency={currency}
                groupId={groupId}
                members={members}
                splits={draftSplits}
                onSetSplits={handleSetSplits}
                initialTab={splitType}
                skipInitialReset={hasCommitted}
                payerIds={payerIds}
                isLockedGroup={isLockedGroup}
                groupName={groupName}
              />
            )}
          </VStack>

          <Box className="items-center justify-center p-4">
            <HStack className="gap-x-2">
              <FormButton
                className="flex-1"
                text="Save Changes"
                disabled={!valid}
                onPress={() => onDone(draftSplits, draftTab)}
              />
            </HStack>
          </Box>
        </KeyboardAvoidingSheet>
      </ActionsheetContent>
    </Actionsheet>
  );
}
