import EXPENSE_STATE from "./features/expense/states/expense.state";
import GROUP_STATE from "./features/group/states/group.state";
import NOTIFICATION_STATE from "./features/notifications/states/notification.state";
import USER_STATE from "./features/user/states/user.state";

const states = {
  user: USER_STATE,
  group: GROUP_STATE,
  expense: EXPENSE_STATE,
  notification: NOTIFICATION_STATE
};

export default states;
