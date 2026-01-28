import { GroupCategory } from '@/types/groups';

export const tables = {
  USERS_TBL: 'users_tbl',
  GROUPS_TBL: 'groups_tbl',
  GROUP_MEMBERS_TBL: 'group_members_tbl',
  TRANSACTIONS_TBL: 'transactions_tbl',
  TRANSACTION_SPLITS_TBL: 'transaction_splits_tbl'
};

export const categories = [
  {
    label: 'Trip',
    value: GroupCategory.TRIP,
    emoji: '✈️'
  },
  {
    label: 'Event',
    value: GroupCategory.EVENT,
    emoji: '🎉'
  },
  {
    label: 'Household',
    value: GroupCategory.HOUSEHOLD,
    emoji: '🏠'
  },
  {
    label: 'Couple',
    value: GroupCategory.COUPLE,
    emoji: '💑'
  },
  {
    label: 'Family',
    value: GroupCategory.FAMILY,
    emoji: '👪'
  },
  {
    label: 'Other',
    value: GroupCategory.OTHER,
    emoji: '📁'
  }
];

export const splitTypes = [
  {
    label: 'Equally',
    value: 'equal'
  },
  {
    label: 'By Percentage',
    value: 'percentage'
  },
  {
    label: 'Custom Amount',
    value: 'custom'
  }
];
