import * as GROUP_SERVICE from "./features/group/services/group.service";
import * as MEMBER_SERVICE from "./features/group/services/member.service";
import * as TRANSACTION_SERVICE from "./features/transaction/services/transaction.service";
import * as AUTH_SERVICE from "./features/user/services/auth.service";
import * as USER_SERVICE from "./features/user/services/user.service";

const services = {
  auth: AUTH_SERVICE,
  user: USER_SERVICE,
  group: GROUP_SERVICE,
  member: MEMBER_SERVICE,
  transaction: TRANSACTION_SERVICE
};

export default services;
