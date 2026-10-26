import { MaterialIcons } from "@expo/vector-icons";

/**
 * The single source of truth for what a Pro subscription includes. Rendered by
 * both the subscription screen and UpgradeSheet, so the paywall and the sheet
 * that leads to it can never drift apart.
 *
 * Keep this in sync with the Pro answers in the Help Center — those spell out
 * the same split in prose, and a mismatch reads as a broken promise.
 */
export const PRO_FEATURES: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  description: string;
}[] = [
  {
    icon: "bolt",
    title: "No Daily Expense Limit",
    description:
      "Add unlimited group and individual expenses — no 5-a-day cap on either."
  },
  {
    icon: "event-repeat",
    title: "Recurring Expenses",
    description:
      "Schedule regular bills in shared groups and private Individual entries."
  },
  {
    icon: "pending-actions",
    title: "Draft Expenses",
    description: "Log an expense now and finalize who paid and the split later."
  },
  {
    icon: "currency-exchange",
    title: "Multi-Currency",
    description:
      "Choose currencies for groups, Individual entries, and expenses, with a separate default for new expenses."
  },
  {
    icon: "trending-up",
    title: "Spending Analytics",
    description:
      "Explore spending across Groups and Individual entries, with trends, categories, and friends."
  },
  {
    icon: "download",
    title: "Export Settlements as CSV",
    description:
      "Download group and friend settlements by date range for your records."
  },
  {
    icon: "star",
    title: "All Future Updates Included",
    description: "Every new Pro feature as it ships, at no extra cost."
  }
];
