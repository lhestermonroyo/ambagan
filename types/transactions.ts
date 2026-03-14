import { UserPreview } from "./user";

export type TransactionState = {
  preview: TransactionPreview[];
  details: Transaction | null;
};

export type Transaction = {
  id: string;
  created_at: string;
  group_id: string;
  created_by: UserPreview;
  paid_by: UserPreview;
  type: TransactionType;
  amount: number;
  description: string;
  receipt: string | null;
};

export type TransactionType = "expense" | "payment";

export type MemberSplit = {
  member: UserPreview;
  amount: number;
  percentage: number;
  status: "settled" | "pending";
};

export type TransactionPreview = Pick<
  Transaction,
  | "id"
  | "created_at"
  | "created_by"
  | "paid_by"
  | "type"
  | "amount"
  | "description"
>;
