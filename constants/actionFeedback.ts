export const ACTION_FEEDBACK = {
  "group-created": {
    title: "Your Group Is Ready",
    description: "Start adding shared expenses, invite your friends, and keep track of who owes whom."
  },
  "group-joined": {
    title: "You’re In!",
    description: "You’ve joined the group. You can now see shared expenses and keep track of your share."
  },
  "individual-created": {
    title: "Your Own Spending Space Is Ready",
    description: "Record expenses that are just yours. Everything in this Individual entry stays private to you."
  },
  "expense-added": {
    title: "Your Expense Is Recorded",
    description: "You’re off to a good start. Keep adding expenses to see where your money goes."
  },
  "settlement-requested": {
    title: "Payment Submitted for Review",
    description: "Your payment has been submitted. The recipient can now review and confirm it."
  },
  "settlement-completed": {
    title: "Payment Settled",
    description: "This payment is marked as settled, and your balances have been updated."
  },
  "partial-payment-recorded": {
    title: "Payment Recorded",
    description: "This part is confirmed. Your remaining balance and payment history have been updated."
  },
  "payment-request-rejected": {
    title: "Payment Request Rejected",
    description: "The remaining balance stays the same. The payment, notes, and proof are kept in history so the sender can check and submit again."
  },
  "payment-request-withdrawn": {
    title: "Payment Request Withdrawn",
    description: "Your request is no longer awaiting confirmation. It stays in history, and you can submit a new payment when you’re ready."
  },
  "payment-reopened": {
    title: "Payment Reopened for Review",
    description: "This payment is awaiting confirmation again. Its amount has been added back to the remaining balance, and its notes and proof are kept."
  },
  "recurring-created": {
    title: "Your Recurring Expense Is Set",
    description: "Ambagan will add this expense on your chosen schedule. You can manage it from Recurring Expenses."
  },
  "draft-finalized": {
    title: "Your Expense Is Ready to Share",
    description: "Your draft has been finalized. The expense and its split are now visible to the group."
  },
  "password-reset": {
    title: "Your Password Is Updated",
    description: "Your new password is saved. You can now log in with it."
  },
  "onboarding-completed": {
    title: "You’re Ready to Chip In",
    description: "Your account is ready. Split bills with your barkada or keep track of your own spending."
  },
  "onboarding-joined": {
    title: "You’re Ready to Chip In",
    description: "Your account is ready, and you’ve joined your invited group. You can start tracking shared expenses together."
  }
} as const;

export type ActionFeedbackKind = keyof typeof ACTION_FEEDBACK;

export function getActionFeedback(kind?: string) {
  return kind && Object.hasOwn(ACTION_FEEDBACK, kind)
    ? ACTION_FEEDBACK[kind as ActionFeedbackKind]
    : { title: "All Done!", description: "Your changes have been saved." };
}
