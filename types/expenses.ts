import { UserPreview } from "./user";

export type ExpenseState = {
  preview: ExpenseSplitPreview[];
  list: ExpenseSplitPreview[];
  details: Expense | null;
};

export type Expense = {
  id: string;
  created_at: string;
  group_id: string;
  created_by: UserPreview;
  paid_by: UserPreview;
  amount: number;
  description: string;
  receipt: string | null;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  created_at: string;
  paid_by: string;
  member: UserPreview;
  amount: number;
  percentage: number;
  status: "paid" | "requested" | "pending";
  note: string | null;
  receipt: string | null;
  payer_note: string | null;
};

export type ExpenseSplitPreview = Pick<
  ExpenseSplit,
  | "id"
  | "expense_id"
  | "created_at"
  | "paid_by"
  | "amount"
  | "status"
  | "member"
> & {
  expense: Pick<Expense, "group_id" | "description" | "amount"> & {
    paid_by: UserPreview;
  };
};
