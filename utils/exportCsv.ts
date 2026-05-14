import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Payment } from "@/types/expenses";
import { format } from "date-fns";

const escapeCell = (value: string) =>
  `"${value.replace(/"/g, '""')}"`;

export const exportGroupSettlementsAsCsv = async (
  payments: Payment[],
  groupName: string
) => {
  const headers = [
    "Date",
    "Expense",
    "Member (Owes)",
    "Payer (Paid by)",
    "Amount",
    "Currency",
    "Status"
  ];

  const rows = payments.map((p) => [
    format(new Date(p.created_at), "yyyy-MM-dd"),
    p.expense_description ?? "",
    `${p.member.first_name} ${p.member.last_name}`.trim(),
    `${p.payer.first_name} ${p.payer.last_name}`.trim(),
    p.amount.toFixed(2),
    p.currency,
    p.status
  ]);

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
