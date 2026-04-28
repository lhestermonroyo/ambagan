import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { SectionList } from "@/components/ui/section-list";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import ExpenseSplitItem from "@/features/expense/components/ExpenseSplitItem";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { getDateGroupTitle } from "@/utils/formatDate";
import { format, parseISO } from "date-fns";
import { useFocusEffect, useRouter } from "expo-router";
import { useMemo, useState } from "react";

const tabs = ["All", "They Owe You", "You Owe", "You Paid"] as const;

export default function ActivitiesScreen() {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("All");
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(true);

  const { list: expenseList } = states.expense.getState();
  const { details: userDetails } = states.user.getState();

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

  const init = async (isInitialized: boolean) => {
    await fetchRecentExpenses(isInitialized).then(() => {
      console.log("activities initialized");
      setInitialized(true);
    });
  };

  const fetchRecentExpenses = async (isInitialized = false) => {
    if (!isInitialized) {
      setLoading(true);
    }

    try {
      const response = await services.expense.getActivitiesByUserId(
        userDetails?.id || "",
        page,
        10,
        true
      );

      if (!response) return;

      states.expense.setState((prev) => ({
        ...prev,
        list: response.data || []
      }));
      setHasNextPage(response.pagination?.hasNext || false);
    } catch (error) {
      console.log("Error fetching recent expenses", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    try {
      setLoadMoreLoading(true);

      const nextPage = page + 1;
      const response = await services.expense.getActivitiesByUserId(
        userDetails?.id || "",
        nextPage,
        10,
        true
      );

      if (!response) return;

      states.expense.setState((prev) => ({
        ...prev,
        list: [...prev.list, ...(response.data || [])]
      }));
      setPage(nextPage);
      setHasNextPage(response.pagination?.hasNext || false);
    } catch (error) {
      console.log("Error loading more activities", error);
    } finally {
      setLoadMoreLoading(false);
    }
  };

  const formattedExpenseList = useMemo(() => {
    let filteredList = expenseList;

    if (tab === "All") {
      filteredList = expenseList;
    } else if (tab === "They Owe You") {
      filteredList = expenseList.filter(
        (item) =>
          item.paid_by === userDetails?.id && item.paid_by !== item.member.id
      );
    } else if (tab === "You Owe") {
      filteredList = expenseList.filter(
        (item) =>
          item.member.id === userDetails?.id && item.paid_by !== userDetails?.id
      );
    } else if (tab === "You Paid") {
      filteredList = expenseList.filter(
        (item) =>
          item.paid_by === userDetails?.id && item.paid_by === item.member.id
      );
    }

    const groupedByDate: { [key: string]: typeof filteredList } = {};

    filteredList.forEach((item) => {
      const createdAt = item.created_at || new Date().toISOString();
      const dateKey = format(parseISO(createdAt), "yyyy-MM-dd");

      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(item);
    });

    const sections = Object.keys(groupedByDate)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((dateKey) => ({
        title: getDateGroupTitle(dateKey + "T00:00:00"),
        data: groupedByDate[dateKey].sort((a, b) => {
          const dateA = a.created_at || new Date().toISOString();
          const dateB = b.created_at || new Date().toISOString();
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })
      }));

    return sections;
  }, [tab, userDetails?.id, expenseList, initialized]);

  return (
    <TabLayout title="Activities">
      <LoadingWrapper
        text="Loading activities, please wait..."
        isLoading={loading}
      >
        <SectionList
          bounces={false}
          sections={formattedExpenseList}
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
          renderSectionHeader={({ section: { title } }) => (
            <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
              <Text className="text-sm text-secondary-950">{title}</Text>
            </Box>
          )}
          ItemSeparatorComponent={() => (
            <Box className="mx-4">
              <Divider className="border-secondary-100" />
            </Box>
          )}
          stickySectionHeadersEnabled={true}
          ListHeaderComponent={useMemo(
            () => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <HStack className="gap-x-2 px-4 mb-4">
                  {tabs.map((type) => (
                    <FormButton
                      size="md"
                      key={type}
                      variant={type === tab ? "solid" : "outline"}
                      className="flex-1 h-10"
                      text={type}
                      onPress={() => setTab(type)}
                    />
                  ))}
                </HStack>
              </ScrollView>
            ),
            [tab]
          )}
          ListEmptyComponent={() => (
            <VStack className="flex-1 justify-center items-center p-4">
              <Text className="text-secondary-950 text-center">
                No activities found. Create or join a group to start adding
                expenses.
              </Text>
            </VStack>
          )}
          ListFooterComponent={useMemo(() => {
            if (hasNextPage) {
              return (
                <FormButton
                  size="md"
                  variant="outline"
                  className="mx-4 my-2"
                  text="Load More"
                  loading={loadMoreLoading}
                  onPress={handleLoadMore}
                />
              );
            }

            return (
              <VStack className="justify-center items-center p-4">
                <Text className="text-secondary-950 text-center">
                  You've reached the end of the activities.
                </Text>
              </VStack>
            );
          }, [hasNextPage, loadMoreLoading])}
        />
      </LoadingWrapper>
    </TabLayout>
  );
}
