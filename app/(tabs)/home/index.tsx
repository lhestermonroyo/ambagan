import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableCard from "@/components/PressableCard";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import ExpenseSplitItem from "@/features/expense/components/ExpenseSplitItem";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import GroupItem from "@/features/group/components/GroupItem";
import services from "@/services";
import states from "@/states";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowBigDownDash,
  ArrowBigUpDash,
  UserCheck,
  UserMinus
} from "lucide-react-native";
import { useMemo, useState } from "react";

export default function HomeScreen() {
  const [loading, setLoading] = useState({
    activities: false,
    groups: false
  });
  const [stats, setStats] = useState({
    totalReceive: 0,
    totalPay: 0
  });
  const [initialized, setInitialized] = useState(false);

  const { details: userDetails } = states.user();
  const { preview: groupPreview } = states.group();
  const { preview: expensePreview } = states.expense();

  const router = useRouter();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id) return;

        init(initialized);
      },
      [userDetails?.id, initialized]
    )
  );

  const init = async (isInitialized = false) => {
    await Promise.all([
      fetchExpenseStatistics(),
      fetchGroups(isInitialized),
      fetchRecentExpenses(isInitialized)
    ]).then(() => {
      console.log("home initialized");
      setInitialized(true);
    });
  };

  const fetchExpenseStatistics = async () => {
    try {
      const response = await services.expense.getExpenseStatsByUserId(
        userDetails?.id || ""
      );

      if (!response) return;

      setStats({
        totalReceive: response.totalReceive,
        totalPay: response.totalPay
      });
    } catch (error) {
      console.error("Failed to fetch expense statistics:", error);
    }
  };

  const fetchRecentExpenses = async (isInitialized = false) => {
    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, activities: true }));
    }

    try {
      const response = await services.expense.getActivitiesByUserId(
        userDetails?.id || "",
        0,
        20,
        false
      );

      if (!response) return;

      states.expense.setState((prev) => ({
        ...prev,
        preview: response.slice(0, 3),
        list: response
      }));
    } catch (error) {
      console.error("Failed to fetch recent expenses:", error);
    } finally {
      setLoading((prev) => ({ ...prev, activities: false }));
    }
  };

  const fetchGroups = async (isInitialized = false) => {
    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, groups: true }));
    }

    try {
      const response = await services.group.getGroupsByUserId(
        userDetails?.id || ""
      );

      if (!response) return;

      states.group.setState((prev) => ({
        ...prev,
        list: response,
        preview: response.slice(0, 3)
      }));
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      setLoading((prev) => ({ ...prev, groups: false }));
    }
  };

  const handleLogout = async () => {
    try {
      await services.auth.logout();
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior="padding">
      <Box className="sticky top-0 pb-4 px-4 pt-20 bg-primary-400">
        <HStack className="items-center">
          <VStack className="flex-1">
            <Text className="text-background-0 opacity-80 text-lg">Hello,</Text>
            <Text bold className="text-2xl text-background-0">
              {userDetails?.first_name} {userDetails?.last_name}
            </Text>
          </VStack>
          <Button variant="link" className="rounded-full">
            <Icon as="notifications" size={28} className="text-background-0" />
          </Button>
        </HStack>
      </Box>
      <ScrollView className="flex-1" bounces={false}>
        <VStack className="gap-y-4 bg-background-0 flex-1">
          <Box className="bg-primary-400 max-h-40">
            <Card
              className="m-4 rounded-2xl shadow-lg shadow-primary-400/20"
              variant="elevated"
            >
              <VStack className="gap-4 items-center">
                <Text className="text-secondary-950 font-semibold uppercase">
                  Current Total
                </Text>
                <HStack className="gap-x-4 items-center">
                  <StatItem type="RECEIVE" amount={stats.totalReceive} />
                  <Divider orientation="vertical" />
                  <StatItem type="PAY" amount={stats.totalPay} />
                </HStack>
                <HStack className="gap-x-2">
                  <FormButton
                    className="flex-1"
                    icon={<Icon as="bolt" className="text-background-0" />}
                    text="Quick Expense"
                    onPress={() => router.push("/groups/[id]/add-expense")}
                  />
                  <FormButton
                    className="flex-1"
                    text="Create Group"
                    icon={<Icon as="group-add" className="text-background-0" />}
                    onPress={() => router.push("/groups/create")}
                  />
                </HStack>
              </VStack>
            </Card>
          </Box>
          <VStack className="mt-20">
            <VStack className="gap-y-2 py-2">
              <HStack className="px-4 gap-x-2">
                <PressableCard
                  className="rounded-lg flex-1"
                  variant="outline"
                  onPress={() => {}}
                >
                  <ArrowBigUpDash className="text-secondary-950" size={20} />
                  <Text className="text-lg">Payables</Text>
                  <Text className="text-secondary-950">0 new</Text>
                </PressableCard>
                <PressableCard
                  className="rounded-lg flex-1"
                  variant="outline"
                  onPress={() => {}}
                >
                  <ArrowBigDownDash className="text-secondary-950" size={20} />
                  <Text className="text-lg">Receivables</Text>
                  <Text className="text-secondary-950">0 new</Text>
                </PressableCard>
              </HStack>
              <HStack className="px-4 gap-x-2">
                <PressableCard
                  className="rounded-lg flex-1"
                  variant="outline"
                  onPress={() => {}}
                >
                  <UserCheck className="text-secondary-950" size={20} />
                  <Text className="text-lg">Requests</Text>
                  <Text className="text-secondary-950">0 new</Text>
                </PressableCard>
                <PressableCard
                  className="rounded-lg flex-1"
                  variant="outline"
                  onPress={() => {}}
                >
                  <UserMinus className="text-secondary-950" size={20} />
                  <Text className="text-lg">Pending</Text>
                  <Text className="text-secondary-950">0 new</Text>
                </PressableCard>
              </HStack>
            </VStack>
          </VStack>
          <VStack>
            <HStack className="items-center justify-between px-4">
              <Text bold className="text-2xl">
                Activities
              </Text>
              <Button variant="link" onPress={() => router.push("/activities")}>
                <Text className="text-primary-400">View All</Text>
              </Button>
            </HStack>
            <LoadingWrapper
              text="Loading activities"
              isLoading={loading.activities}
            >
              <FlatList
                data={expensePreview}
                scrollEnabled={false}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <ExpenseSplitItem
                    item={item}
                    onOpen={() =>
                      router.push(
                        `/groups/${item.expense.group_id}/${item.expense_id}`
                      )
                    }
                  />
                )}
                ItemSeparatorComponent={() => (
                  <Box className="mx-4">
                    <Divider className="border-secondary-100" />
                  </Box>
                )}
                ListEmptyComponent={() => (
                  <VStack className="flex-1 justify-center items-center p-4">
                    <Text className="text-secondary-950">
                      No activities recorded yet.
                    </Text>
                  </VStack>
                )}
              />
            </LoadingWrapper>
          </VStack>
          <VStack>
            <HStack className="items-center justify-between px-4">
              <Text bold className="text-2xl">
                Groups
              </Text>
              <Button variant="link" onPress={() => router.push("/groups")}>
                <Text className="text-primary-400">View All</Text>
              </Button>
            </HStack>
            <LoadingWrapper
              text="Loading previous groups"
              isLoading={loading.groups}
            >
              <FlatList
                data={groupPreview}
                scrollEnabled={false}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <GroupItem
                    details={item}
                    onOpen={() => router.push(`/groups/${item.id}`)}
                  />
                )}
                ItemSeparatorComponent={() => (
                  <Box className="mx-4">
                    <Divider className="border-secondary-100" />
                  </Box>
                )}
                ListEmptyComponent={() => (
                  <VStack className="flex-1 justify-center items-center p-4">
                    <Text className="text-secondary-950">
                      No groups joined or created yet.
                    </Text>
                  </VStack>
                )}
              />
            </LoadingWrapper>
          </VStack>
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatItem({
  type,
  amount
}: {
  type: "RECEIVE" | "PAY";
  amount: number;
}) {
  return (
    <HStack className="gap-x-4 items-center flex-1 h-24">
      <VStack className="gap-y-2 items-center flex-1">
        <Text className="text-secondary-950">
          {type === "RECEIVE" ? "They Owe You" : "You Owe"}
        </Text>
        <Text
          bold
          className={cn(
            "text-3xl",
            type === "RECEIVE" ? "text-primary-400" : "text-error-400"
          )}
        >
          {formatAmount(amount)}
        </Text>
      </VStack>
    </HStack>
  );
}
