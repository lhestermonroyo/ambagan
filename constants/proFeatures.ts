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
    title: "No daily expense limit",
    description:
      "Add unlimited group and personal expenses — no 5-a-day cap on either."
  },
  {
    icon: "event-repeat",
    title: "Recurring expenses",
    description:
      "Auto-post rent, subscriptions, and regular bills on a schedule — in groups and books."
  },
  {
    icon: "pending-actions",
    title: "Draft expenses",
    description: "Log an expense now and finalize who paid and the split later."
  },
  {
    icon: "currency-exchange",
    title: "Multi-currency",
    description:
      "Set the currency per group, per book, and per expense — PHP, JPY, SGD, and more."
  },
  {
    icon: "trending-up",
    title: "Spending analytics",
    description:
      "See where your money goes — across groups, books, months, and friends."
  },
  {
    icon: "download",
    title: "Export settlements as CSV",
    description:
      "Download group and friend settlements by date range for your records."
  },
  {
    icon: "star",
    title: "All future updates included",
    description: "Every new Pro feature as it ships, at no extra cost."
  }
];
