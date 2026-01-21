import { UserPreview } from './auth';

export type TransactionState = {
  preview: TransactionPreview[];
  details: Transaction | null;
};

export type Transaction = {
  id: string;
  created_at: string;
  created_by: UserPreview;
  paid_by: UserPreview;
  type: 'expense' | 'payment';
  amount: number;
  description: string;
  receipt_ref_number: string | null;
  receipt_photo: string | null;
  splits: MemberSplit[];
};

export type MemberSplit = {
  member: UserPreview;
  amount: number;
};

export type TransactionPreview = Pick<
  Transaction,
  | 'id'
  | 'created_at'
  | 'created_by'
  | 'paid_by'
  | 'type'
  | 'amount'
  | 'description'
>;
