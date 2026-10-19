import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { PaymentExportRow } from "@/types/expenses";
import { expenseCategories } from "@/utils/constants";
import { format } from "date-fns";

const escapeCell = (value: string) =>
  `"${value.replace(/"/g, '""')}"`;

/** Human-readable label for a stored category value ("food" → "Food & Drinks"),
 *  falling back to the last option ("Other") for anything unrecognized. */
const categoryLabel = (value: string) =>
  (
    expenseCategories.find((c) => c.value === value) ??
    expenseCategories[expenseCategories.length - 1]
  ).label;

/** Date only (yyyy-MM-dd) for a nullable ISO string; "" when absent. */
const formatDate = (value: string | null) =>
  value ? format(new Date(value), "yyyy-MM-dd") : "";

/** Date + time for lifecycle timestamps; "" when the step hasn't happened yet. */
const formatDateTime = (value: string | null) =>
  value ? format(new Date(value), "yyyy-MM-dd HH:mm") : "";

export const exportGroupSettlementsAsCsv = async (
  payments: PaymentExportRow[],
  groupName: string
) => {
  const headers = [
    "Settlement ID",
    "Recorded Date",
    "Expense Date",
    "Expense",
    "Category",
    "Member (Owes)",
    "Payer (Paid by)",
    "Original Amount",
    "Confirmed Paid",
    "Remaining Balance",
    "Currency",
    "Status",
    "Requested At",
    "Settled At",
    "Member Note",
    "Payer Note",
    "Payment ID", "Payment Amount", "Payment Status", "Payment Added At",
    "Payment Confirmed At", "Payment Reopened At", "Payment Rejected At", "Payment Withdrawn At", "Payment Proof"
  ];

  const rows = payments.flatMap((p) => (p.payment_history?.length ? [...p.payment_history]
    .sort((a, b) => a.created_at.localeCompare(b.created_at)) : [null]).map((entry) => [
    p.id,
    formatDate(p.created_at),
    formatDate(p.expense_date),
    p.expense_description ?? "",
    categoryLabel(p.expense_category),
    `${p.member.first_name} ${p.member.last_name}`.trim(),
    `${p.payer.first_name} ${p.payer.last_name}`.trim(),
    p.amount.toFixed(2),
    (p.confirmed_paid_amount ?? (p.status === "settled" ? p.amount : 0)).toFixed(2),
    Math.max(0, p.amount - (p.confirmed_paid_amount ?? (p.status === "settled" ? p.amount : 0))).toFixed(2),
    p.currency,
    p.status,
    formatDateTime(p.requested_at),
    formatDateTime(p.settled_at),
    entry?.member_note ?? (entry ? "" : p.member_note ?? ""),
    entry?.payer_note ?? (entry ? "" : p.payer_note ?? ""),
    entry?.id ?? "", entry?.amount.toFixed(2) ?? "", entry?.status ?? "",
    formatDateTime(entry?.created_at ?? null), formatDateTime(entry?.confirmed_at ?? null),
    formatDateTime(entry?.reopened_at ?? null), formatDateTime(entry?.rejected_at ?? null),
    formatDateTime(entry?.withdrawn_at ?? null), entry?.proof_of_payment ?? ""
  ]));

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\n");

  const safeName = groupName.replace(/[^a-z0-9]/gi, "_");
  const dateStamp = format(new Date(), "yyyyMMdd");
  const fileName = `${safeName}_settlements_${dateStamp}.csv`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error("Sharing is not available on this device");

  await Sharing.shareAsync(fileUri, {
    mimeType: "text/csv",
    dialogTitle: `Export ${groupName} Settlements`,
    UTI: "public.comma-separated-values-text"
  });
};

/** Friend pair export. The CSV shape is identical to the group export (each row
 *  is self-describing), so this delegates — the passed name just scopes the
 *  file name and share dialog to the friend instead of a group. */
export const exportFriendSettlementsAsCsv = async (
  payments: PaymentExportRow[],
  friendName: string
) => exportGroupSettlementsAsCsv(payments, friendName);
