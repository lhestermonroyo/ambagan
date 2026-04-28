import { GroupCategory } from "@/types/groups";

export const tables = {
  USERS_TBL: "users_tbl",
  GROUPS_TBL: "groups_tbl",
  GROUP_MEMBERS_TBL: "group_members_tbl",
  EXPENSES_TBL: "expenses_tbl",
  EXPENSE_PAYERS_TBL: "expense_payers_tbl",
  MEMBER_SPLITS_TBL: "member_splits_tbl",
  PAYMENT_SPLITS_TBL: "payment_splits_tbl",
  NOTIFICATIONS_TBL: "notifications_tbl"
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

export const categories = [
  {
    label: "✈️ Trip",
    value: GroupCategory.TRIP
  },
  {
    label: "🎉 Event",
    value: GroupCategory.EVENT
  },
  {
    label: "🏠 Household",
    value: GroupCategory.HOUSEHOLD
  },
  {
    label: "💼 Work",
    value: GroupCategory.WORK
  },
  {
    label: "💑 Couple",
    value: GroupCategory.COUPLE
  },
  {
    label: "👪 Family",
    value: GroupCategory.FAMILY
  },
  {
    label: "📁 Other",
    value: GroupCategory.OTHER
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
  s: "bg-lavender-500",
  t: "bg-mauve-500",
  u: "bg-slate-500",
  v: "bg-zinc-500",
  w: "bg-crimson-500",
  x: "bg-sienna-500",
  y: "bg-turquoise-500",
  z: "bg-chartreuse-500"
};
