import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

export type AnalyticsSummary = {
  expenseCount: number;
  totalInvolved: number;
  totalPaid: number;
};

export type GroupSpending = {
  groupId: string;
  groupName: string;
  amount: number;
};

export type MonthlyTrend = {
  key: string;
  label: string;
  amount: number;
};

export type TopPartner = {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  count: number;
};

export type AnalyticsData = {
  summary: AnalyticsSummary;
  byGroup: GroupSpending[];
  monthlyTrend: MonthlyTrend[];
  topPartners: TopPartner[];
};

export const getAnalyticsData = async (
  userId: string,
  cutoff: Date | null
): Promise<AnalyticsData> => {
  // 1. Fetch member splits for user
  const { data: memberSplits, error: memberError } = await supabase
    .from(tables.MEMBER_SPLITS_TBL)
    .select("id, amount, expense_id")
    .eq("member_id", userId);

  if (memberError) throw memberError;

  // 2. Fetch payer splits for user
  const { data: payerSplits, error: payerError } = await supabase
    .from(tables.EXPENSE_PAYERS_TBL)
    .select("id, amount, expense_id")
    .eq("payer_id", userId);

  if (payerError) throw payerError;

  const allExpenseIds = [
    ...new Set([
      ...(memberSplits ?? []).map((s) => s.expense_id),
      ...(payerSplits ?? []).map((s) => s.expense_id)
    ])
  ];

  if (allExpenseIds.length === 0) {
    return {
      summary: { expenseCount: 0, totalInvolved: 0, totalPaid: 0 },
      byGroup: [],
      monthlyTrend: buildEmptyMonthlyTrend(),
      topPartners: []
    };
  }

  // 3. Fetch expenses (with group info) for those IDs
  const { data: expenses, error: expenseError } = await supabase
    .from(tables.EXPENSES_TBL)
    .select("id, created_at, group_id, currency")
    .in("id", allExpenseIds);

  if (expenseError) throw expenseError;

  // 4. Filter by date cutoff client-side
  const filteredExpenses = (expenses ?? []).filter(
    (e) => !cutoff || new Date(e.created_at) >= cutoff
  );
  const filteredExpenseIds = new Set(filteredExpenses.map((e) => e.id));

  const filteredMemberSplits = (memberSplits ?? []).filter((s) =>
    filteredExpenseIds.has(s.expense_id)
  );
  const filteredPayerSplits = (payerSplits ?? []).filter((s) =>
    filteredExpenseIds.has(s.expense_id)
  );

  // 5. Summary
  const summary: AnalyticsSummary = {
    expenseCount: filteredExpenseIds.size,
    totalInvolved: filteredMemberSplits.reduce((sum, s) => sum + s.amount, 0),
    totalPaid: filteredPayerSplits.reduce((sum, s) => sum + s.amount, 0)
  };

  // 6. Spending by group
  const expenseMap = Object.fromEntries(filteredExpenses.map((e) => [e.id, e]));
  const groupAmounts: Record<string, number> = {};

  for (const split of filteredMemberSplits) {
    const expense = expenseMap[split.expense_id];
    if (!expense) continue;
    groupAmounts[expense.group_id] =
      (groupAmounts[expense.group_id] ?? 0) + split.amount;
  }

  const groupIds = Object.keys(groupAmounts);
  let byGroup: GroupSpending[] = [];

  if (groupIds.length > 0) {
    const { data: groups } = await supabase
      .from(tables.GROUPS_TBL)
      .select("id, name")
      .in("id", groupIds);

    const groupNameMap = Object.fromEntries(
      (groups ?? []).map((g) => [g.id, g.name])
    );

    byGroup = groupIds
      .map((id) => ({
        groupId: id,
        groupName: groupNameMap[id] ?? "Unknown Group",
        amount: groupAmounts[id]
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  // 7. Monthly trend (last 6 months, always)
  const monthlyTrend = buildEmptyMonthlyTrend();
  for (const split of filteredMemberSplits) {
    const expense = expenseMap[split.expense_id];
    if (!expense) continue;
    const d = new Date(expense.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const month = monthlyTrend.find((m) => m.key === key);
    if (month) month.amount += split.amount;
  }

  // 8. Top split partners
  let topPartners: TopPartner[] = [];

  if (filteredExpenseIds.size > 0) {
    const { data: otherSplits } = await supabase
      .from(tables.MEMBER_SPLITS_TBL)
      .select(
        "expense_id, member_id, member:member_id (id, first_name, last_name, avatar)"
      )
      .in("expense_id", [...filteredExpenseIds])
      .neq("member_id", userId);

    const partnerMap: Record<
      string,
      { user: any; count: number }
    > = {};

    for (const split of otherSplits ?? []) {
      if (!partnerMap[split.member_id]) {
        partnerMap[split.member_id] = { user: split.member, count: 0 };
      }
      partnerMap[split.member_id].count++;
    }

    topPartners = Object.values(partnerMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ user, count }) => ({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar ?? null,
        count
      }));
  }

  return { summary, byGroup, monthlyTrend, topPartners };
};

const buildEmptyMonthlyTrend = (): MonthlyTrend[] => {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString("default", { month: "short" }),
      amount: 0
    };
  });
};
