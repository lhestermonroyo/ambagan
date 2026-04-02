import EXPENSE_STATE from "./features/expense/states/expense.state";
import GROUP_STATE from "./features/group/states/group.state";
import USER_STATE from "./features/user/states/user.state";

const states = {
  user: USER_STATE,
  group: GROUP_STATE,
  expense: EXPENSE_STATE
};

export default states;
