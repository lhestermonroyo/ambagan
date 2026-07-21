import { RefreshControl } from "@/components/ui/refresh-control";
import { ScrollView } from "@/components/ui/scroll-view";
import GroupRecurring from "@/features/group/components/GroupRecurring";
import InnerLayout from "@/layouts/InnerLayout";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

/**
 * Standalone route for a group's recurring-expense series. The list itself
 * lives in the reusable GroupRecurring component (also rendered inline under
 * the Expenses tab's Recurring filter); this screen just wraps it in the
 * shared layout with pull-to-refresh.
 */
export default function RecurringExpensesScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
    // GroupRecurring refetches on the trigger change; release the spinner on
    // the next tick since the child owns the request lifecycle.
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <InnerLayout title="Recurring Expenses" onBack={() => router.back()}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <GroupRecurring groupId={groupId} refreshTrigger={refreshTrigger} />
      </ScrollView>
    </InnerLayout>
  );
}
