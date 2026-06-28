import * as ANALYTICS_SERVICE from "./features/analytics/services/analytics.service";
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

const services = {
  analytics: ANALYTICS_SERVICE,
  auth: AUTH_SERVICE,
  user: USER_SERVICE,
  preferences: PREFERENCES_SERVICE,
  pushToken: PUSH_TOKEN_SERVICE,
  purchase: PURCHASE_SERVICE,
  group: GROUP_SERVICE,
  member: MEMBER_SERVICE,
  expense: EXPENSE_SERVICE,
  friend: FRIEND_SERVICE,
  notification: NOTIFICATION_SERVICE
};

export default services;
