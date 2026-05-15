import { UserPreview } from "./user";

export type ExpenseState = {
  activityList: PaymentPreview[];
  details: Expense | null;
  payerList: ExpensePayer[];
  memberSplitList: MemberSplit[];
  paymentSplitList: Payment[];
};

export type Expense = {
  id: string;
  created_at: string;
  group_id: string;
  creator: UserPreview;
  amount: number;
  description: string;
  expense_date: string;
  proof_of_payment: string | null;
  split_type: SplitType;
  currency: string;
  status: PaymentStatus;
};

export type ExpensePayer = {
  id: string;
  created_at: string;
  expense_id: string;
  payer: UserPreview;
  amount: number;
  currency: string;
};

export type ExpensePreview = Pick<
  Expense,
  | "id"
  | "created_at"
  | "group_id"
  | "amount"
  | "description"
  | "creator"
  | "currency"
  | "status"
> & {
  payer_list: ExpensePayer[];
};

export type MemberSplit = {
  id: string;
  created_at: string;
  expense_id: string;
  member: UserPreview;
  amount: number;
  percentage: number;
  currency: string;
};

export type Payment = {
  id: string;
  created_at: string;
  group_id: string;
  expense_id: string;
  expense_description: string | null;
  member: UserPreview;
  payer: UserPreview;
  amount: number;
  currency: string;
  proof_of_payment: string | null;
  member_note: string | null;
  payer_note: string | null;
  status: PaymentStatus;
  status_updated_at: string;
};

export type PaymentPreview = Pick<
  Payment,
  | "id"
  | "created_at"
  | "group_id"
  | "expense_id"
  | "member"
  | "payer"
  | "amount"
  | "currency"
  | "status"
> & {
  expense_description?: string | null;
};

export type FriendBalance = {
  currency: string;
  amount: number;
};

export type FriendSummary = {
  friend: UserPreview;
  balances: FriendBalance[];
};

export enum SplitType {
  EQUAL = "equal",
  PERCENTAGE = "percentage",
  CUSTOM = "custom"
}

export enum PaymentStatus {
  PENDING = "pending",
  REQUESTED = "requested",
  SETTLED = "settled",
  ONGOING = "ongoing",
  COMPLETED = "completed"
}
