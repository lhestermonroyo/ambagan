export const ACTION_FEEDBACK = {
  "group-created": {
    title: "Your group is ready",
    description: "Start adding shared expenses, invite your friends, and keep track of who owes whom."
  },
  "group-joined": {
    title: "You’re in!",
    description: "You’ve joined the group. You can now see shared expenses and keep track of your share."
  },
  "individual-created": {
    title: "Your own spending space is ready",
    description: "Record expenses that are just yours. Everything in this Individual entry stays private to you."
  },
  "expense-added": {
    title: "Your expense is recorded",
    description: "You’re off to a good start. Keep adding expenses to see where your money goes."
  },
  "settlement-requested": {
    title: "Payment submitted for review",
    description: "Your settlement request has been sent. The person receiving your payment can now review and approve it."
  },
  "settlement-completed": {
    title: "Payment settled",
    description: "This payment is marked as settled, and your balances have been updated."
  },
  "recurring-created": {
    title: "Your recurring expense is set",
    description: "Ambagan will add this expense on your chosen schedule. You can manage it from Recurring expenses."
  },
  "draft-finalized": {
    title: "Your expense is ready to share",
    description: "Your draft has been finalized. The expense and its split are now visible to the group."
  },
  "password-reset": {
    title: "Your password is updated",
    description: "Your new password is saved. You can now log in with it."
  },
  "onboarding-completed": {
    title: "You’re ready to chip in",
    description: "Your account is ready. Split bills with your barkada or keep track of your own spending."
  },
  "onboarding-joined": {
    title: "You’re ready to chip in",
    description: "Your account is ready, and you’ve joined your invited group. You can start tracking shared expenses together."
  }
} as const;

export type ActionFeedbackKind = keyof typeof ACTION_FEEDBACK;

export function getActionFeedback(kind?: string) {
  return kind && Object.hasOwn(ACTION_FEEDBACK, kind)
    ? ACTION_FEEDBACK[kind as ActionFeedbackKind]
    : { title: "All done!", description: "Your changes have been saved." };
}
