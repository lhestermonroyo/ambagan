import { getDateGroupTitle } from "@/utils/formatDate";
import { format, parseISO } from "date-fns";

type Section<T> = { title: string; data: T[] };

export function groupByDate<T extends { created_at: string }>(
  items: T[]
): Section<T>[] {
  const grouped: Record<string, T[]> = {};
  items.forEach((item) => {
    const dateKey = format(parseISO(item.created_at), "yyyy-MM-dd");
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(item);
  });
  return Object.keys(grouped)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .map((dateKey) => ({
      title: getDateGroupTitle(dateKey + "T00:00:00"),
      data: grouped[dateKey]
    }));
}

export function groupByExpenseId<
  T extends { expense_id: string; expense_description?: string | null }
>(items: T[]): Section<T>[] {
  const grouped: Record<string, T[]> = {};
  items.forEach((item) => {
    if (!grouped[item.expense_id]) grouped[item.expense_id] = [];
    grouped[item.expense_id].push(item);
  });
  return Object.keys(grouped).map((expenseId) => ({
    title: grouped[expenseId][0].expense_description || "Unknown Expense",
    data: grouped[expenseId]
  }));
}
