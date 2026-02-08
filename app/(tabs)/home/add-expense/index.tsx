import AmountInput from '@/components/AmountInput';
import FormButton from '@/components/FormButton';
import FormTextarea from '@/components/FormTextarea';
import Icon from '@/components/Icon';
import Avatar from '@/components/_Avatar';
import AvatarGroup from '@/components/_AvatarGroup';
import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { FlatList } from '@/components/ui/flat-list';
import {
  FormControl,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText
} from '@/components/ui/form-control';
import { HStack } from '@/components/ui/hstack';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { Group } from '@/types/groups';
import { splitTypes } from '@/utils/constants';
import { mockGroups } from '@/utils/data';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, ChevronsUpDown, Upload } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, TextInput } from 'react-native';

function GroupSelection({ group }: { group: Group }) {
  return (
    <Pressable className="p-4 bg-white rounded-2xl">
      <HStack className="gap-x-4 justify-center items-center">
        <VStack className="flex-1 gap-y-4">
          <VStack>
            <Text className="text-xl">{group.name}</Text>
            <Text className="text-secondary-950">
              Created last {format(group.created_at, 'MMM. dd, yyyy - hh:mm a')}
            </Text>
          </VStack>
          <AvatarGroup
            maxDisplay={3}
            size="md"
            items={group.members.map((member) => ({
              id: member.user.id,
              avatar: member.user.avatar,
              name: member.user.first_name
            }))}
          />
        </VStack>
        <Icon as={ChevronsUpDown} className="text-secondary-950" />
      </HStack>
    </Pressable>
  );
}

export default function AddExpenseScreen() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [values, setValues] = useState({
    amount: '',
    description: '',
    group: null
  });
  const [formErrors, setFormErrors] = useState({
    amount: '',
    description: ''
  }) as any;
  const [splits, setSplits] = useState<{
    [userId: string]: {
      amount: string;
      percentage: string;
      isIncluded: boolean;
    };
  }>({});

  const group = mockGroups[0];

  if (step === 2) {
    return (
      <SplitSelection
        values={values}
        group={group}
        splits={splits}
        setSplits={setSplits}
        onBack={() => setStep(1)}
      />
    );
  }

  return (
    <KeyboardAvoidingView className="bg-primary-0 flex-1" behavior="padding">
      <Box className="sticky top-0 bg-white px-4 pb-4 pt-20 border-b border-background-100">
        <HStack className="items-center justify-between">
          <Button
            variant="link"
            className="rounded-full h-[18] w-[18]"
            onPress={() => router.back()}
          >
            <Icon as={ArrowLeft} className="text-secondary-950" />
          </Button>
          <Text bold className="flex-1 text-center text-xl">
            Add New Expense
          </Text>
          <Box className="w-6" />
        </HStack>
      </Box>
      <ScrollView>
        <VStack className="gap-y-6 p-4">
          <AmountInput
            label="Amount"
            placeholder="Enter amount"
            value={values.amount}
            onChangeText={(text) => setValues({ ...values, amount: text })}
            autoCapitalize="none"
            keyboardType="numeric"
            errorMessage={formErrors.amount}
          />

          <FormTextarea
            label="Description"
            placeholder="Enter description (e.g., Dinner at KFC Baguio)"
            value={values.description}
            onChangeText={(text) => setValues({ ...values, description: text })}
            autoCapitalize="none"
            errorMessage={formErrors.description}
          />

          <FormControl size="md">
            <FormControlLabel>
              <FormControlLabelText>Group</FormControlLabelText>
            </FormControlLabel>
            <GroupSelection group={group} />
            <FormControlHelper>
              <FormControlHelperText className="text-secondary-950">
                Select the group this expense belongs to.
              </FormControlHelperText>
            </FormControlHelper>
          </FormControl>

          <VStack className="gap-y-1">
            <Pressable className="border-dashed border-2 border-secondary-800 rounded-3xl h-32 w-full justify-center items-center flex">
              <VStack className="items-center gap-y-2">
                <Icon as={Upload} className="text-secondary-950" size={36} />
                <Text className="text-secondary-950">
                  Upload Proof of Payment
                </Text>
              </VStack>
            </Pressable>
            <Text className="text-secondary-950">
              Proof could be a photo of receipt, screenshot of online payment,
              or any document that shows the expense details.
            </Text>
          </VStack>
        </VStack>
      </ScrollView>
      <HStack className="sticky bottom-0 bg-white px-4 pt-4 pb-10 gap-x-2 border-t border-background-100">
        <FormButton
          className="flex-1"
          variant="outline"
          text="Save & Exit"
          disabled={!values.amount || !values.description}
        />
        <FormButton
          className="flex-1"
          text="Continue"
          // disabled={!values.amount || !values.description}
          onPress={() => setStep(2)}
        />
      </HStack>
    </KeyboardAvoidingView>
  );
}

function SplitSelection({
  values,
  group,
  splits,
  setSplits,
  onBack
}: {
  values: {
    amount: string;
    description: string;
  };
  group: Group;
  splits: {
    [userId: string]: {
      amount: string;
      percentage: string;
      isIncluded: boolean;
    };
  };
  setSplits: (splits: {
    [userId: string]: {
      amount: string;
      percentage: string;
      isIncluded: boolean;
    };
  }) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<string>(splitTypes[0].value);
  const totalAmount = parseFloat(values.amount) || 0;

  // Initialize splits when component mounts or when tab changes
  useEffect(() => {
    const initialSplits: {
      [userId: string]: {
        amount: string;
        percentage: string;
        isIncluded: boolean;
      };
    } = {};

    group.members.forEach((member) => {
      if (!splits[member.user.id]) {
        initialSplits[member.user.id] = {
          amount:
            tab === 'equal'
              ? (totalAmount / group.members.length).toFixed(2)
              : '0.00',
          percentage:
            tab === 'equal' ? (100 / group.members.length).toFixed(2) : '0.00',
          isIncluded: tab === 'equal' ? true : false
        };
      } else {
        initialSplits[member.user.id] = splits[member.user.id];
      }
    });

    if (tab === 'equal') {
      // For equal split, recalculate amounts
      const includedMembers = Object.entries(initialSplits).filter(
        ([_, split]) => split.isIncluded
      );
      const amountPerPerson =
        includedMembers.length > 0 ? totalAmount / includedMembers.length : 0;
      const percentagePerPerson =
        includedMembers.length > 0 ? 100 / includedMembers.length : 0;

      Object.keys(initialSplits).forEach((userId) => {
        if (initialSplits[userId].isIncluded) {
          initialSplits[userId].amount = amountPerPerson.toFixed(2);
          initialSplits[userId].percentage = percentagePerPerson.toFixed(2);
        } else {
          initialSplits[userId].amount = '0.00';
          initialSplits[userId].percentage = '0.00';
        }
      });
    }

    setSplits(initialSplits);
  }, [tab, totalAmount, group.members.length]);

  const toggleMemberInclusion = (userId: string) => {
    const newSplits = { ...splits };
    newSplits[userId].isIncluded = !newSplits[userId].isIncluded;

    if (tab === 'equal') {
      // Recalculate equal splits
      const includedMembers = Object.entries(newSplits).filter(
        ([_, split]) => split.isIncluded
      );
      const amountPerPerson =
        includedMembers.length > 0 ? totalAmount / includedMembers.length : 0;
      const percentagePerPerson =
        includedMembers.length > 0 ? 100 / includedMembers.length : 0;

      Object.keys(newSplits).forEach((userId) => {
        if (newSplits[userId].isIncluded) {
          newSplits[userId].amount = amountPerPerson.toFixed(2);
          newSplits[userId].percentage = percentagePerPerson.toFixed(2);
        } else {
          newSplits[userId].amount = '0.00';
          newSplits[userId].percentage = '0.00';
        }
      });
    } else if (!newSplits[userId].isIncluded) {
      // If unchecked, reset their amount/percentage
      newSplits[userId].amount = '0.00';
      newSplits[userId].percentage = '0.00';
    }

    setSplits(newSplits);
  };

  const updateSplitAmount = (userId: string, amount: string) => {
    const newSplits = { ...splits };
    newSplits[userId].amount = amount;

    if (tab === 'custom') {
      const percentage =
        totalAmount > 0
          ? (((parseFloat(amount) || 0) / totalAmount) * 100).toFixed(2)
          : '0.00';
      newSplits[userId].percentage = percentage;
      newSplits[userId].isIncluded = parseFloat(amount) > 0;
    }

    setSplits(newSplits);
  };

  const updateSplitPercentage = (userId: string, percentage: string) => {
    const newSplits = { ...splits };
    newSplits[userId].percentage = percentage;

    if (tab === 'percentage') {
      // Calculate amount based on percentage
      const amount = (
        (totalAmount * (parseFloat(percentage) || 0)) /
        100
      ).toFixed(2);
      newSplits[userId].amount = amount;
      newSplits[userId].isIncluded = parseFloat(percentage) > 0;
    }

    setSplits(newSplits);
  };

  const totalSplitAmount = Object.values(splits).reduce(
    (sum, split) => sum + (parseFloat(split.amount) || 0),
    0
  );
  const totalPercentage = Object.values(splits).reduce(
    (sum, split) => sum + (parseFloat(split.percentage) || 0),
    0
  );

  const isValidSplit =
    Math.abs(totalSplitAmount - totalAmount) < 0.01 &&
    Math.abs(totalPercentage - 100) < 0.01;

  return (
    <KeyboardAvoidingView className="bg-primary-0 flex-1" behavior="padding">
      <Box className="sticky top-0 bg-white pb-4 pt-20 border-b border-background-100">
        <VStack className="gap-y-4">
          <HStack className="items-center justify-between px-4">
            <Button
              variant="link"
              className="rounded-full h-[18] w-[18]"
              onPress={onBack}
            >
              <Icon as={ArrowLeft} className="text-secondary-950" />
            </Button>
            <Text bold className="flex-1 text-center text-xl">
              Split Expense
            </Text>
            <Box className="w-6" />
          </HStack>
          <VStack className="px-4">
            <Text className="text-3xl font-bold">
              ₱ {values.amount || '0.00'}
            </Text>
            <Text>{values.description || 'No description provided.'}</Text>
          </VStack>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack className="justify-center items-center gap-x-2 px-4">
              {splitTypes.map((type) => (
                <FormButton
                  key={type.value}
                  variant={type.value === tab ? 'solid' : 'outline'}
                  className="flex-1"
                  text={type.label}
                  onPress={() => setTab(type.value)}
                />
              ))}
            </HStack>
          </ScrollView>
        </VStack>
      </Box>
      <ScrollView className="bg-white flex-1">
        <VStack className="p-4 gap-y-4">
          <Text className="text-typography-700 text-lg font-medium">
            Split ₱{parseFloat(values.amount || '0').toLocaleString()} among{' '}
            {group.members.length} people
          </Text>

          <Box className="p-3 bg-background-100 rounded-lg">
            <Text className="text-sm text-typography-600 mb-1">
              Total Amount: ₱{totalSplitAmount.toFixed(2)} / ₱
              {totalAmount.toFixed(2)}
            </Text>
            <Text className="text-sm text-typography-600 mb-1">
              Total Percentage: {totalPercentage.toFixed(1)}%
            </Text>
            {!isValidSplit && (
              <Text className="text-sm text-error-600">
                ⚠️ Split amounts don't match the total expense
              </Text>
            )}
          </Box>

          <FlatList
            data={group.members}
            keyExtractor={(member) => member.user.id}
            ItemSeparatorComponent={() => (
              <Divider className="bg-secondary-100" />
            )}
            renderItem={({ item: member }) => (
              <MemberItem
                member={member}
                splitType={tab}
                split={
                  splits[member.user.id] || {
                    amount: '0.00',
                    percentage: '0.00',
                    isIncluded: false
                  }
                }
                totalAmount={totalAmount}
                onToggle={() => toggleMemberInclusion(member.user.id)}
                onAmountChange={(amount) =>
                  updateSplitAmount(member.user.id, amount)
                }
                onPercentageChange={(percentage) =>
                  updateSplitPercentage(member.user.id, percentage)
                }
              />
            )}
          />
        </VStack>
      </ScrollView>
      <HStack className="sticky bottom-0 bg-white px-4 pt-4 pb-10 gap-x-2 border-t border-background-100">
        <FormButton
          className="flex-1"
          variant="outline"
          text="Back"
          onPress={onBack}
        />
        <FormButton
          className="flex-1"
          text="Save Expense"
          disabled={!isValidSplit}
        />
      </HStack>
    </KeyboardAvoidingView>
  );
}

function MemberItem({
  member,
  splitType,
  split,
  totalAmount,
  onToggle,
  onAmountChange,
  onPercentageChange
}: {
  member: any;
  splitType: string;
  split: { amount: string; percentage: string; isIncluded: boolean };
  totalAmount: number;
  onToggle: () => void;
  onAmountChange: (amount: string) => void;
  onPercentageChange: (percentage: string) => void;
}) {
  const user = member.user;

  return (
    <Box className="py-4">
      <HStack className="gap-x-4 items-center">
        {/* Checkbox */}
        <Pressable onPress={onToggle}>
          <Box
            className={`w-6 h-6 rounded border-2 ${split.isIncluded ? 'bg-primary-500 border-primary-500' : 'border-background-300'} items-center justify-center`}
          >
            {split.isIncluded && (
              <Icon as={Check} size={16} className="text-white" />
            )}
          </Box>
        </Pressable>

        {/* Avatar and Name */}
        <Avatar name={user.first_name} uri={user.avatar} size="md" />
        <VStack className="flex-1">
          <Text className="text-lg font-medium">
            {user.first_name} {user.last_name}
          </Text>
        </VStack>

        {split.isIncluded && (
          <VStack className="items-end">
            {splitType === 'equal' && (
              <VStack className="items-end">
                <Text className="text-lg">₱{split.amount}</Text>
                <Text className="text-secondary-950">{split.percentage}%</Text>
              </VStack>
            )}

            {splitType === 'percentage' && (
              <VStack className="items-end">
                <HStack className="items-end justify-end gap-x-1">
                  <TextInput
                    value={split.percentage}
                    onChangeText={onPercentageChange}
                    keyboardType="numeric"
                    placeholder="0"
                    className="text-right border-b border-background-300 rounded p-0 py-1 text-xl w-16"
                  />
                  <Text className="text-xl">%</Text>
                </HStack>
                <Text className="text-secondary-950">₱{split.amount}</Text>
              </VStack>
            )}

            {splitType === 'custom' && (
              <VStack className="items-end">
                <HStack className="items-end justify-end gap-x-1">
                  <Text className="text-xl">₱</Text>
                  <TextInput
                    value={split.amount}
                    onChangeText={onAmountChange}
                    keyboardType="numeric"
                    placeholder="0.00"
                    className="text-right border-b border-background-300 rounded p-0 py-1 text-xl w-16"
                  />
                </HStack>
                <Text className="text-secondary-950">{split.percentage}%</Text>
              </VStack>
            )}
          </VStack>
        )}
      </HStack>
    </Box>
  );
}
