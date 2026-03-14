import { GroupCategory } from "@/types/groups";

export const tables = {
  USERS_TBL: "users_tbl",
  GROUPS_TBL: "groups_tbl",
  GROUP_MEMBERS_TBL: "group_members_tbl",
  TRANSACTIONS_TBL: "transactions_tbl",
  TRANSACTION_SPLITS_TBL: "transaction_splits_tbl"
};

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
    label: "💑 Couple",
    value: GroupCategory.COUPLE
  },
  {
    label: "👪 Family",
    value: GroupCategory.FAMILY,
  },
  {
    label: "📁 Other",
    value: GroupCategory.OTHER,
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