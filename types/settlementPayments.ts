/** Each payment keeps its own proof, notes and lifecycle dates. */
export type SettlementPaymentEntry = {
  id: string;
  amount: number;
  status: "requested" | "confirmed" | "rejected" | "withdrawn";
  created_at: string;
  settlement_id?: string;
  mode?: "full" | "partial";
  created_by?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  rejected_at?: string | null;
  withdrawn_at?: string | null;
  /** A confirmed payment reopened for review is requested again. */
  reopened_at?: string | null;
  member_note?: string | null;
  payer_note?: string | null;
  proof_of_payment?: string | null;
};

export type SettlementPaymentAction = "confirm" | "reject" | "withdraw" | "reopen";

export type SettlementPaymentResult = {
  payment: SettlementPaymentEntry;
  changed: boolean;
  settlement_id: string;
  member_id: string | null;
  payer_id: string | null;
  confirmed_paid_amount: number;
  remaining_amount: number;
  settled: boolean;
};
