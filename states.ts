import GROUP_STATE from "./features/group/states/group.state";
import TRANSACTION_STATE from "./features/transaction/states/transaction.state";
import USER_STATE from "./features/user/states/user.state";

const states = {
  user: USER_STATE,
  group: GROUP_STATE,
  transaction: TRANSACTION_STATE
};

export default states;
