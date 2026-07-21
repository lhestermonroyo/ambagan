import { ImagePickerSuccessResult } from "expo-image-picker";
import { UserPreview } from "./user";

/**
 * Transient hand-off from Scan Receipt (Beta) to the new-expense form. Carries
 * the fields parsed off the receipt plus the picked image (which doubles as the
 * expense's proof-of-payment). Set right before navigating to new-expense and
 * cleared once the form seeds itself. Kept in the store rather than route params
 * because the picked-image object doesn't serialize cleanly through navigation.
 */
export type ScanDraft = {
  amount: string | null;
  description: string | null;
  currency: string | null;
  date: string | null;
  proof_of_payment: ImagePickerSuccessResult;
};

/**
 * Normalized result from the scan-receipt Edge Function. Shape is stable across
 * AI-vendor swaps (Gemini Flash today, Claude Haiku later) — see the function.
 */
export type ScanResult = {
  amount: string | null;
  currency: string | null;
  description: string | null;
  merchant: string | null;
  date: string | null;
  confidence: number;
};

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
  /** True while the expense is a draft (amount + description only, no splits yet). */
  is_draft: boolean;
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
  | "is_draft"
> & {
  payer_list: ExpensePayer[];
  /**
   * True once any of the expense's payment splits has moved past "pending"
   * (requested/settled). Mirrors the detail screen's edit guard so the list can
   * decide editability without a per-row hydration round-trip. Absent on
   * offline-created previews (treated as no progress).
   */
  has_settlement_progress?: boolean;
  /** True for an expense created offline and not yet synced to the server. */
  pending?: boolean;
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
  /** When the member requested settlement (status → requested). */
  requested_at: string | null;
  /** When the payer marked/approved the settlement (status → settled). */
  settled_at: string | null;
  /** When the payer rejected a request. Persists after the split reverts to
   *  pending so a rejection date can still be shown. Cleared on re-request. */
  rejected_at: string | null;
  /** True for a settlement generated from an offline expense, not yet synced. */
  pending?: boolean;
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
  /**
   * Full-detail fields the home Recent Activity feed now selects alongside the
   * preview (see getPaymentsByUserId). Optional because offline-generated
   * previews omit them. When present, the settlement sheets render without a
   * hydration round-trip.
   */
  proof_of_payment?: string | null;
  member_note?: string | null;
  payer_note?: string | null;
  status_updated_at?: string;
  requested_at?: string | null;
  settled_at?: string | null;
  rejected_at?: string | null;
  /** True for a settlement generated from an offline expense, not yet synced. */
  pending?: boolean;
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
