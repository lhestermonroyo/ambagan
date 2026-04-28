import { UserPreview } from "./user";

export type ExpenseState = {
  paymentList: PaymentPreview[];
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
};

export type ExpensePayer = {
  id: string;
  created_at: string;
  expense_id: string;
  payer: UserPreview;
  amount: number;
};

export type ExpensePreview = Pick<
  Expense,
  "id" | "created_at" | "group_id" | "amount" | "description" | "creator"
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
};

export type Payment = {
  id: string;
  created_at: string;
  group_id: string;
  expense_id: string;
  member: UserPreview;
  payer: UserPreview;
  amount: number;
  proof_of_payment: string | null;
  member_note: string | null;
  payer_note: string | null;
  status: PaymentStatus;
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
  | "status"
>;

export enum SplitType {
  EQUAL = "equal",
  PERCENTAGE = "percentage",
  CUSTOM = "custom"
}

export enum PaymentStatus {
  PENDING = "pending",
  REQUESTED = "requested",
  SETTLED = "settled",
  REJECTED = "rejected"
}
