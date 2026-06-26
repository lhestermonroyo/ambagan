import AmountInput from "@/components/AmountInput";
import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import CurrencySelection from "@/components/CurrencySelection";
import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UpgradeSheet from "@/components/UpgradeSheet";
import { GroupSelectionActionSheet } from "@/features/expense/components/GroupSelection";
import { PayerSelectionActionSheet } from "@/features/expense/components/PayerSelection";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  generatePaymentSplits,
  getAmountPerPerson,
  getPercentagePerPerson
} from "@/features/expense/utils/split.util";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Group, Member } from "@/types/groups";
import { DAILY_EXPENSE_LIMIT } from "@/utils/constants";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView
} from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { CalendarDays } from "lucide-react-native";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useColorScheme } from "react-native";

type QuickAddExpenseSheetProps = {
  isOpen: boolean;
  group: Group | null;
  allowGroupChange?: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function QuickAddExpenseSheet({
  isOpen,
  group,
  allowGroupChange = false,
  onClose,
  onSuccess
}: QuickAddExpenseSheetProps) {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(group);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedPayer, setSelectedPayer] = useState<Member | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [payerPickerOpen, setPayerPickerOpen] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);
  const [upgradeDescription, setUpgradeDescription] = useState<
    string | undefined
  >(undefined);
  const [dailyCount, setDailyCount] = useState(0);

  const { details: currentUser, defaultCurrency } = states.user();
  const isPro = currentUser?.plan === "pro";
  const toast = useAppToast();
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const dateSheetRef = useRef<BottomSheetModal>(null);

  const openDateSheet = useCallback(() => dateSheetRef.current?.present(), []);
  const closeDateSheet = useCallback(() => dateSheetRef.current?.dismiss(), []);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setDescription("");
      setExpenseDate(new Date());
      setSelectedGroup(group);
      setSelectedPayer(null);
      setCurrency(isPro ? defaultCurrency : "PHP");
      if (group) fetchMembers(group.id);
      if (!isPro && currentUser?.id) {
        services.expense
          .getDailyExpenseCount(currentUser.id)
          .then(setDailyCount)
          .catch(() => {});
      }
    } else {
      setMembers([]);
      setSelectedPayer(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedGroup && isOpen) {
      setCurrency(isPro ? defaultCurrency : "PHP");
      fetchMembers(selectedGroup.id);
    }
  }, [selectedGroup?.id]);

  const fetchMembers = async (groupId: string) => {
    try {
      const result = await services.member.getMembersByGroupId(groupId);
      if (result) {
        setMembers(result);
        const self = result.find((m) => m.id === currentUser?.id);
        setSelectedPayer(self ?? result[0] ?? null);
      }
    } catch {
      // submit stays disabled if fetch fails
    }
  };

  const memberAvatars = useMemo(
    () =>
      members.map((m) => ({
        id: m.id,
        name: m.first_name,
        uri: m.avatar || undefined
      })),
    [members]
  );

  const parsedAmount = parseFloat(amount) || 0;
  const memberCount = members.length;
  const perPerson = memberCount > 0 ? parsedAmount / memberCount : 0;

  const canSubmit =
    parsedAmount > 0 &&
    description.trim().length > 0 &&
    !submitting &&
    memberCount >= 2 &&
    !!currentUser &&
    !!selectedGroup &&
    !!selectedPayer;

  const handleSubmit = async () => {
    if (!currentUser || !selectedGroup || !canSubmit) return;

    if (!isPro) {
      const count = await services.expense.getDailyExpenseCount(currentUser.id);
      if (count >= DAILY_EXPENSE_LIMIT) {
        setUpgradeDescription(
          "You've reached your 5 expense limit for today. Upgrade to Pro for unlimited expenses."
        );
        setUpgradeSheetOpen(true);
        return;
      }
    }

    setSubmitting(true);

    try {
      const amounts = getAmountPerPerson(parsedAmount, memberCount);
      const percentages = getPercentagePerPerson(memberCount);

      const memberSplits = members.map((m, i) => ({
        userId: m.id,
        amount: amounts[i],
        percentage: percentages[i]
      }));

      const payers = [
        { userId: selectedPayer?.id ?? currentUser.id, amount: parsedAmount }
      ];
      const paymentSplits = generatePaymentSplits(payers, memberSplits);

      await services.expense.saveExpense(
        {
          amount: parsedAmount,
          description: description.trim(),
          group_id: selectedGroup.id,
          proof_of_payment: null,
          split_type: "equal",
          currency,
          expense_date: expenseDate
        },
        payers,
        memberSplits,
        paymentSplits
      );

      toast({
        title: "Expense Added",
        description: "Split equally among all members.",
        type: "success"
      });
      onSuccess();
      onClose();
    } catch {
      toast({
        title: "Failed",
        description: "Could not add expense. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full flex-1">
            <HStack className="align-items justify-between">
              <Pressable onPress={onClose}>
                <HStack className="p-4 items-start">
                  <Icon as="arrow-back-ios" className="text-secondary-950" />
                  <VStack>
                    <Text bold className="text-xl">
                      Quick Add
                    </Text>
                    <Text className="text-sm text-secondary-950">
                      Paid by you · Equal split · Dated today
                    </Text>
                  </VStack>
                </HStack>
              </Pressable>
              {!isPro && (
                <VStack className="px-4 pt-4">
                  <DailyLimitText
                    count={dailyCount}
                    limit={DAILY_EXPENSE_LIMIT}
                  />
                </VStack>
              )}
            </HStack>

            {!group ? (
              <VStack className="flex-1 p-4">
                <VStack className="items-center justify-center flex-1 gap-y-4">
                  <Icon
                    as="sentiment-dissatisfied"
                    size={64}
                    className="text-primary-400"
                  />
                  <Text className="text-center">
                    You are not part of any group yet. Please join or create a
                    group to be able to add an expense.
                  </Text>
                  <FormButton
                    text="Create Group"
                    iconEnd={
                      <Icon as="chevron-right" className="text-background-0" />
                    }
                    onPress={() => router.push("/groups/create")}
                  />
                </VStack>
              </VStack>
            ) : (
              <>
                <ScrollView className="flex-1 px-4">
                  <VStack className="gap-y-6">
                    <FormControl size="md">
                      <FormControlLabel>
                        <FormControlLabelText>Amount</FormControlLabelText>
                      </FormControlLabel>
                      <HStack className="gap-x-2 items-end h-12">
                        <CurrencySelection
                          currency={currency}
                          onCurrencyChange={setCurrency}
                          locked={!isPro}
                          onLockedPress={() => {
                            setUpgradeDescription(
                              "Multi-currency expenses are a Pro feature. Upgrade to split bills in any currency."
                            );
                            setUpgradeSheetOpen(true);
                          }}
                        />
                        <VStack className="flex-1">
                          <AmountInput
                            className="h-full"
                            placeholder="0.00"
                            value={amount}
                            onChangeText={setAmount}
                          />
                        </VStack>
                      </HStack>
                    </FormControl>

                    <FormTextarea
                      label="Description"
                      placeholder="Enter description (e.g., Dinner at KFC Baguio)"
                      value={description}
                      onChangeText={setDescription}
                      autoCapitalize="none"
                      size="sm"
                    />

                    <FormControl size="md">
                      <FormControlLabel>
                        <FormControlLabelText>
                          Expense Date
                        </FormControlLabelText>
                      </FormControlLabel>
                      <PressableListItem
                        onPress={openDateSheet}
                        className="p-4 border border-background-200 rounded-lg"
                      >
                        <HStack className="items-center flex-1 gap-x-2">
                          <CalendarDays
                            color={getSecondaryHex(
                              "text-secondary-950",
                              colorScheme
                            )}
                          />
                          <Text className="flex-1 text-lg">
                            {format(expenseDate, "MMMM dd, yyyy")}
                          </Text>
                          <Icon
                            as="unfold-more"
                            className="text-sm text-secondary-950"
                          />
                        </HStack>
                      </PressableListItem>
                    </FormControl>

                    {selectedPayer && (
                      <FormControl size="md">
                        <FormControlLabel>
                          <FormControlLabelText>Payer</FormControlLabelText>
                        </FormControlLabel>
                        <PressableListItem
                          className="p-4 border border-background-200 rounded-lg"
                          onPress={() => setPayerPickerOpen(true)}
                        >
                          <HStack className="justify-between items-center gap-x-2 flex-1">
                            <HStack className="gap-x-3 items-center flex-1">
                              <AppAvatar
                                name={`${selectedPayer.first_name} ${selectedPayer.last_name ?? ""}`.trim()}
                                uri={selectedPayer.avatar ?? ""}
                              />
                              <VStack className="flex-1">
                                <HStack className="gap-x-1 items-center">
                                  <Text className="text-lg">
                                    {selectedPayer.first_name}{" "}
                                    {selectedPayer.last_name}{" "}
                                    {selectedPayer.id === currentUser?.id &&
                                      "(You)"}
                                  </Text>
                                </HStack>
                                <Text className="text-sm text-secondary-950">
                                  {selectedPayer.email}
                                </Text>
                              </VStack>
                            </HStack>
                            <Icon
                              as="unfold-more"
                              className="text-sm text-secondary-950"
                            />
                          </HStack>
                        </PressableListItem>
                      </FormControl>
                    )}

                    {memberCount > 0 && (
                      <Fragment>
                        {allowGroupChange ? (
                          <PressableListItem
                            className="p-4 border border-background-200 rounded-lg"
                            onPress={() => setGroupPickerOpen(true)}
                          >
                            <HStack className="justify-between items-center gap-x-2">
                              <HStack className="gap-x-2 items-center flex-1">
                                <VStack className="gap-y-2 flex-1">
                                  <Text
                                    bold
                                    className="text-sm text-secondary-950 uppercase"
                                    numberOfLines={1}
                                  >
                                    {selectedGroup?.name}
                                  </Text>
                                  <VStack className="items-start gap-y-1">
                                    <AppAvatarGroup
                                      items={memberAvatars}
                                      size="sm"
                                      maxDisplay={4}
                                    />
                                    <Text className="text-secondary-950 text-sm">
                                      {memberCount} member
                                      {memberCount !== 1 ? "s" : ""}
                                    </Text>
                                  </VStack>
                                </VStack>
                                <VStack className="items-end">
                                  <Text
                                    bold
                                    className="text-2xl text-primary-400"
                                  >
                                    {formatAmount(perPerson, currency)}
                                  </Text>
                                  <Text className="text-secondary-950 text-sm">
                                    each
                                  </Text>
                                </VStack>
                              </HStack>
                              <Icon
                                as="unfold-more"
                                className="text-sm text-secondary-950"
                              />
                            </HStack>
                          </PressableListItem>
                        ) : (
                          <Box className="p-4 border border-background-200 rounded-lg">
                            <HStack className="justify-between items-center gap-x-2 flex-1">
                              <HStack className="gap-x-2 items-center flex-1">
                                <VStack className="gap-y-2 flex-1">
                                  <Text
                                    bold
                                    className="text-sm text-secondary-950 uppercase"
                                    numberOfLines={1}
                                  >
                                    {selectedGroup?.name}
                                  </Text>
                                  <VStack className="items-start gap-y-1">
                                    <AppAvatarGroup
                                      items={memberAvatars}
                                      size="sm"
                                      maxDisplay={4}
                                    />
                                    <Text className="text-secondary-950 text-sm">
                                      {memberCount} member
                                      {memberCount !== 1 ? "s" : ""}
                                    </Text>
                                  </VStack>
                                </VStack>
                                <VStack className="items-end">
                                  <Text
                                    bold
                                    className="text-2xl text-primary-400"
                                  >
                                    {formatAmount(perPerson, currency)}
                                  </Text>
                                  <Text className="text-secondary-950 text-sm">
                                    each
                                  </Text>
                                </VStack>
                              </HStack>
                            </HStack>
                          </Box>
                        )}
                      </Fragment>
                    )}
                  </VStack>
                </ScrollView>

                <Box className="items-center justify-center p-4">
                  <HStack className="gap-x-2">
                    <FormButton
                      className="flex-1"
                      text="Add Expense"
                      loading={submitting}
                      disabled={!canSubmit}
                      onPress={handleSubmit}
                    />
                  </HStack>
                </Box>
              </>
            )}
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      {selectedGroup && (
        <GroupSelectionActionSheet
          isOpen={groupPickerOpen}
          onClose={() => setGroupPickerOpen(false)}
          currentGroup={selectedGroup}
          onChangeGroup={(g) => setSelectedGroup(g)}
        />
      )}
      <PayerSelectionActionSheet
        isOpen={payerPickerOpen}
        members={members}
        currentPayer={selectedPayer}
        onClose={() => setPayerPickerOpen(false)}
        onSave={(payer) => setSelectedPayer(payer)}
      />

      <UpgradeSheet
        isOpen={upgradeSheetOpen}
        onClose={() => setUpgradeSheetOpen(false)}
        description={upgradeDescription}
      />

      <BottomSheetModal
        ref={dateSheetRef}
        snapPoints={["60%"]}
        backgroundStyle={{
          backgroundColor: getSecondaryHex("text-secondary-0", colorScheme)
        }}
        handleIndicatorStyle={{
          backgroundColor: getSecondaryHex("text-secondary-500", colorScheme)
        }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
          />
        )}
      >
        <BottomSheetView>
          <VStack className="gap-y-2 items-center">
            <VStack className="self-start px-4">
              <Text
                bold
                className="text-xl"
                style={{
                  color: colorScheme === "dark" ? "#F5F5F5" : "#141414"
                }}
              >
                Select Expense Date
              </Text>
            </VStack>
            <VStack className="pb-4">
              <DateTimePicker
                value={expenseDate}
                mode="date"
                display="inline"
                themeVariant={colorScheme}
                accentColor={getPrimaryHex("text-primary-400", colorScheme)}
                onChange={(_, date) => {
                  if (date) {
                    setExpenseDate(date);
                    closeDateSheet();
                  }
                }}
              />
            </VStack>
          </VStack>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

function DailyLimitText({ count, limit }: { count: number; limit: number }) {
  const remaining = limit - count;
  const isLimitReached = remaining <= 0;

  return (
    <Badge
      size="md"
      variant="solid"
      className={`rounded-full px-3 py-2 ${isLimitReached ? "bg-error-50" : "bg-primary-50"}`}
    >
      <BadgeText
        className={`font-bold text-xs uppercase ${isLimitReached ? "text-error-600" : "text-primary-400"}`}
      >
        {isLimitReached ? "LIMIT REACHED" : `${remaining} / ${limit} LEFT`}
      </BadgeText>
    </Badge>
  );
}
