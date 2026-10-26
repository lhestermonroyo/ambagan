import * as ANALYTICS_SERVICE from "./features/analytics/services/analytics.service";
import * as APP_VERSION_SERVICE from "./features/user/services/app-version.service";
import * as BOOK_SERVICE from "./features/book/services/book.service";
import * as BOOK_EXPENSE_SERVICE from "./features/book/services/book-expense.service";
import * as BOOK_RECURRING_SERVICE from "./features/book/services/book-recurring.service";
import * as EXPENSE_SERVICE from "./features/expense/services/expense.service";
import * as FRIEND_SERVICE from "./features/friends/services/friend.service";
import * as GROUP_SERVICE from "./features/group/services/group.service";
import * as NOTIFICATION_SERVICE from "./features/notifications/services/notification.service";
import * as MEMBER_SERVICE from "./features/group/services/member.service";
import * as AUTH_SERVICE from "./features/user/services/auth.service";
import * as USER_SERVICE from "./features/user/services/user.service";
import * as PREFERENCES_SERVICE from "./features/user/services/preferences.service";
import * as PUSH_TOKEN_SERVICE from "./features/user/services/push-token.service";
import * as PURCHASE_SERVICE from "./features/user/services/purchase.service";
import { withDataInvalidation } from "./utils/dataRefresh";

const groupChange = [
  "groups",
  "groupDetails",
  "settlements",
  "contacts"
] as const;
const expenseChange = ["groups", "groupDetails", "settlements"] as const;
// Expense rows also cache whether editing is blocked by payment history.
const settlementChange = ["groups", "groupDetails", "settlements"] as const;
const individualChange = ["groups"] as const;

const services = {
  analytics: ANALYTICS_SERVICE,
  appVersion: APP_VERSION_SERVICE,
  auth: AUTH_SERVICE,
  user: USER_SERVICE,
  preferences: PREFERENCES_SERVICE,
  pushToken: PUSH_TOKEN_SERVICE,
  purchase: PURCHASE_SERVICE,
  group: withDataInvalidation(GROUP_SERVICE, {
    saveGroup: groupChange,
    updateGroup: groupChange,
    deleteGroup: groupChange,
    joinGroupByToken: groupChange,
    resetGroupInvite: ["groupDetails"],
    archiveGroup: groupChange,
    unarchiveGroup: groupChange
  }),
  member: withDataInvalidation(MEMBER_SERVICE, {
    leaveGroup: groupChange,
    updateGroupMembers: groupChange,
    setMemberRole: groupChange
  }),
  book: withDataInvalidation(BOOK_SERVICE, {
    saveBook: individualChange,
    updateBook: individualChange,
    deleteBook: individualChange,
    linkBookToGroup: individualChange,
    archiveBook: individualChange,
    unarchiveBook: individualChange
  }),
  bookExpense: withDataInvalidation(BOOK_EXPENSE_SERVICE, {
    savePersonalExpense: individualChange,
    updatePersonalExpense: individualChange,
    setPersonalExpenseStatus: individualChange,
    deletePersonalExpense: individualChange
  }),
  bookRecurring: BOOK_RECURRING_SERVICE,
  expense: withDataInvalidation(EXPENSE_SERVICE, {
    saveExpense: expenseChange,
    saveDraftExpense: expenseChange,
    updateExpense: expenseChange,
    finalizeDraft: expenseChange,
    deleteExpense: expenseChange,
    attachExpenseProof: expenseChange,
    submitSettlementPayment: settlementChange,
    transitionSettlementPayment: settlementChange,
    saveRecurringExpense: ["recurring"],
    updateRecurringExpense: ["recurring"],
    setRecurringActive: ["recurring"],
    deleteRecurringExpense: ["recurring"]
  }),
  friend: withDataInvalidation(FRIEND_SERVICE, {
    bulkSettleWithFriend: settlementChange,
    bulkRequestSettleWithFriend: settlementChange,
    addFavorite: ["contacts"],
    removeFavorite: ["contacts"]
  }),
  notification: NOTIFICATION_SERVICE
};

export default services;
