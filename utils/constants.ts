import { ExpenseCategory } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { GroupCategory } from "@/types/groups";
import {
  BedDouble,
  Briefcase,
  Car,
  Clapperboard,
  Folder,
  Heart,
  House,
  LucideIcon,
  PartyPopper,
  PiggyBank,
  Pill,
  Plane,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Star,
  Users,
  UtensilsCrossed
} from "lucide-react-native";

export const DAILY_EXPENSE_LIMIT = 5;

// Free-tier daily cap on personal (book) expenses. A SEPARATE bucket from
// DAILY_EXPENSE_LIMIT — a free user gets 5 group + 5 personal expenses per day,
// each tracked by its own append-only creation log.
export const PERSONAL_EXPENSE_LIMIT = 5;

export const tables = {
  USERS_TBL: "users_tbl",
  GROUPS_TBL: "groups_tbl",
  GROUP_MEMBERS_TBL: "group_members_tbl",
  EXPENSES_TBL: "expenses_tbl",
  RECURRING_EXPENSES_TBL: "recurring_expenses_tbl",
  EXPENSE_CREATION_LOG_TBL: "expense_creation_log_tbl",
  EXPENSE_PAYERS_TBL: "expense_payers_tbl",
  MEMBER_SPLITS_TBL: "member_splits_tbl",
  PAYMENT_SPLITS_TBL: "payment_splits_tbl",
  NOTIFICATIONS_TBL: "notifications_tbl",
  USER_FAVORITES_TBL: "user_favorites_tbl",
  USER_PREFERENCES_TBL: "user_preferences_tbl",
  USER_PUSH_TOKENS_TBL: "user_push_tokens_tbl",
  // Personal-expense feature (standalone "books").
  PERSONAL_BOOKS_TBL: "personal_books_tbl",
  PERSONAL_EXPENSES_TBL: "personal_expenses_tbl",
  PERSONAL_RECURRING_TBL: "personal_recurring_tbl",
  PERSONAL_EXPENSE_CREATION_LOG_TBL: "personal_expense_creation_log_tbl",

  // Indicative FX rates, refreshed weekly by the refresh-fx-rates Edge
  // Function. Read-only to the app (see utils/fx.ts).
  FX_RATES_TBL: "fx_rates_tbl"
};

// apply signs to all currencies
export const currencies = [
  {
    label: "PHP (₱)",
    subtitle: "Philippine Peso",
    sign: "₱",
    value: "PHP"
  },
  {
    label: "USD ($)",
    subtitle: "US Dollar",
    sign: "$",
    value: "USD"
  },
  {
    label: "EUR (€)",
    subtitle: "Euro",
    sign: "€",
    value: "EUR"
  },
  {
    label: "JPY (¥)",
    subtitle: "Japanese Yen",
    sign: "¥",
    value: "JPY"
  },
  {
    label: "GBP (£)",
    subtitle: "British Pound",
    sign: "£",
    value: "GBP"
  },
  {
    label: "CNY (¥)",
    subtitle: "Chinese Yuan",
    sign: "¥",
    value: "CNY"
  },
  {
    label: "KRW (₩)",
    subtitle: "South Korean Won",
    sign: "₩",
    value: "KRW"
  },
  {
    label: "SGD (S$)",
    subtitle: "Singapore Dollar",
    sign: "S$",
    value: "SGD"
  },
  {
    label: "VND (₫)",
    subtitle: "Vietnamese Dong",
    sign: "₫",
    value: "VND"
  },
  {
    label: "THB (฿)",
    subtitle: "Thai Baht",
    sign: "฿",
    value: "THB"
  },
  {
    label: "TWD (NT$)",
    subtitle: "New Taiwan Dollar",
    sign: "NT$",
    value: "TWD"
  },
  {
    label: "MYR (RM)",
    subtitle: "Malaysian Ringgit",
    sign: "RM",
    value: "MYR"
  },
  {
    label: "IDR (Rp)",
    subtitle: "Indonesian Rupiah",
    sign: "Rp",
    value: "IDR"
  },
  {
    label: "INR (₹)",
    subtitle: "Indian Rupee",
    sign: "₹",
    value: "INR"
  }
];

export type CategoryOption = {
  label: string;
  value: string;
  icon: LucideIcon;
  /**
   * Identity color for charts/legends (budget bar, breakdowns). One hex per
   * category, picked mid-tone so it reads on both the light and dark card
   * surfaces. Only the expense categories carry one — group categories are
   * never charted.
   */
  color?: string;
};

export const categories: CategoryOption[] = [
  {
    label: "General",
    value: GroupCategory.GENERAL,
    icon: Star
  },
  {
    label: "Trip",
    value: GroupCategory.TRIP,
    icon: Plane
  },
  {
    label: "Event",
    value: GroupCategory.EVENT,
    icon: PartyPopper
  },
  {
    label: "Household",
    value: GroupCategory.HOUSEHOLD,
    icon: House
  },
  {
    label: "Work",
    value: GroupCategory.WORK,
    icon: Briefcase
  },
  {
    label: "Couple",
    value: GroupCategory.COUPLE,
    icon: Heart
  },
  {
    label: "Family",
    value: GroupCategory.FAMILY,
    icon: Users
  },
  {
    label: "Other",
    value: GroupCategory.OTHER,
    icon: Folder
  }
];

// Per-expense spending categories (distinct from the group-level `categories`
// above). Lucide icons match the group-category picker style; `value` is stored
// on expenses_tbl.category and drives the Stats breakdown. "Other" is the
// server default, so it's the implicit fallback for anything left unset.
export const expenseCategories: CategoryOption[] = [
  {
    label: "General",
    value: ExpenseCategory.GENERAL,
    icon: Star,
    color: "#7C3AED"
  },
  {
    label: "Food & Drinks",
    value: ExpenseCategory.FOOD,
    icon: UtensilsCrossed,
    color: "#F97316"
  },
  {
    label: "Groceries",
    value: ExpenseCategory.GROCERIES,
    icon: ShoppingCart,
    color: "#6366F1"
  },
  {
    label: "Transport",
    value: ExpenseCategory.TRANSPORT,
    icon: Car,
    color: "#3B82F6"
  },
  {
    label: "Accommodation",
    value: ExpenseCategory.ACCOMMODATION,
    icon: BedDouble,
    color: "#14B8A6"
  },
  {
    label: "Entertainment",
    value: ExpenseCategory.ENTERTAINMENT,
    icon: Clapperboard,
    color: "#EC4899"
  },
  {
    label: "Shopping",
    value: ExpenseCategory.SHOPPING,
    icon: ShoppingBag,
    color: "#EAB308"
  },
  {
    label: "Bills & Utilities",
    value: ExpenseCategory.BILLS,
    icon: ReceiptText,
    color: "#EF4444"
  },
  {
    label: "Health",
    value: ExpenseCategory.HEALTH,
    icon: Pill,
    color: "#06B6D4"
  },
  // Money set aside rather than consumed. It is deliberately a normal spending
  // category: the amount leaves the wallet, so it counts against a book's budget
  // like everything else and needs no special-casing in the totals. Its payoff is
  // the Stats gauge — with the date range on "All", the savings slice is the
  // running total set aside across every month the book has existed.
  {
    label: "Savings",
    value: ExpenseCategory.SAVINGS,
    icon: PiggyBank,
    color: "#22C55E"
  },
  // Keep "Other" last — expenseCategoryMeta() falls back to the final entry for
  // any unrecognized value (see CategorySheet), so a new category appended here
  // would silently become that fallback.
  {
    label: "Other",
    value: ExpenseCategory.OTHER,
    icon: Folder,
    color: "#94A3B8"
  }
];

export const splitTypes = [
  {
    label: "Equally",
    value: "equal"
  },
  {
    label: "By Percentage",
    value: "percentage"
  },
  {
    label: "Customize Split",
    value: "custom"
  }
];

export const emptyTypes = [
  {
    type: EmptyType.FRIEND,
    content: "No friends with outstanding settlements yet.",
    icon: "👫"
  },
  {
    type: EmptyType.ACTIVITY,
    content: "No activities yet.",
    icon: "📋"
  },
  {
    type: EmptyType.GROUP,
    content: "No groups yet. Create or join a group to get started!",
    icon: "🏠"
  },
  {
    type: EmptyType.BOOK,
    content: "No books yet. Create one to start tracking your personal spending!",
    icon: "📒"
  },
  {
    type: EmptyType.EXPENSE,
    content: "No expenses yet. Start adding some!",
    icon: "💸"
  },
  {
    type: EmptyType.SETTLEMENT,
    content: "No settlements yet.",
    icon: "🤝"
  },
  {
    type: EmptyType.NOTIFICATION,
    content: "No notifications yet.",
    icon: "🔔"
  },
  {
    type: EmptyType.USER,
    content: "No users found.",
    icon: "👤"
  },
  {
    type: EmptyType.FAVORITE,
    content: "No favorites yet.",
    icon: "❤️"
  },
  {
    type: EmptyType.SEARCH,
    content: "No results found on your search.",
    icon: "😔"
  },
  {
    type: EmptyType.MEMBER,
    content: "No members found.",
    icon: "👥"
  },
  {
    type: EmptyType.OUTSTANDING,
    content: "You're all settled up with this person.",
    icon: "🎉"
  },
  {
    type: EmptyType.HISTORY,
    content: "No settled payments with this person yet.",
    icon: "📭"
  },
  {
    type: EmptyType.SETTLEMENT_ALL,
    content: "No settlements in this group yet.",
    icon: "🤝"
  },
  {
    type: EmptyType.SETTLEMENT_PENDING,
    content: "No pending settlements.",
    icon: "⏳"
  },
  {
    type: EmptyType.SETTLEMENT_REQUESTED,
    content: "No requested settlements.",
    icon: "📨"
  },
  {
    type: EmptyType.SETTLEMENT_SETTLED,
    content: "No settled payments yet.",
    icon: "✅"
  }
];

export const avatarColors = {
  a: "bg-red-500",
  b: "bg-green-500",
  c: "bg-blue-500",
  d: "bg-yellow-500",
  e: "bg-purple-500",
  f: "bg-pink-500",
  g: "bg-indigo-500",
  h: "bg-gray-500",
  i: "bg-teal-500",
  j: "bg-cyan-500",
  k: "bg-orange-500",
  l: "bg-lime-500",
  m: "bg-sky-500",
  n: "bg-violet-500",
  o: "bg-fuchsia-500",
  p: "bg-rose-500",
  q: "bg-stone-500",
  r: "bg-amber-500",
  s: "bg-emerald-500",
  t: "bg-red-900",
  u: "bg-slate-500",
  v: "bg-zinc-500",
  w: "bg-red-700",
  x: "bg-orange-800",
  y: "bg-teal-400",
  z: "bg-lime-600"
};

export const introSlideContent = [
  {
    title: "Who paid for what again?",
    description:
      "Stop the awkward back-and-forth. Ambagan tracks every shared expense so you always know exactly who owes what."
  },
  {
    title: "Split it. Settle it. Done.",
    description:
      "Add expenses, split them your way — equally, by percentage, or custom — and request settlements with one tap."
  },
  {
    title: "No more IOUs. Just good vibes.",
    description:
      "Whether it's a group trip, dinner with friends, or shared bills — Ambagan keeps money from getting in the way."
  }
];
