import type { ImageSourcePropType } from "react-native";
import type { ActionFeedbackKind } from "@/constants/actionFeedback";

// Static requires let Metro bundle every illustration for offline feedback.
const FEEDBACK_ILLUSTRATIONS = {
  "pro-activated": require("@/assets/illustrations/feedback/pro-activated.png"),
  "pro-restored": require("@/assets/illustrations/feedback/pro-restored.png"),
  "group-created": require("@/assets/illustrations/feedback/group-created.png"),
  "group-joined": require("@/assets/illustrations/feedback/group-joined.png"),
  "individual-created": require("@/assets/illustrations/feedback/individual-created.png"),
  "expense-added": require("@/assets/illustrations/feedback/expense-added.png"),
  "settlement-requested": require("@/assets/illustrations/feedback/settlement-requested.png"),
  "settlement-completed": require("@/assets/illustrations/feedback/settlement-completed.png"),
  "partial-payment-recorded": require("@/assets/illustrations/feedback/partial-payment-recorded.png"),
  "payment-request-rejected": require("@/assets/illustrations/feedback/payment-updated.png"),
  "payment-request-withdrawn": require("@/assets/illustrations/feedback/payment-updated.png"),
  "payment-reopened": require("@/assets/illustrations/feedback/settlement-requested.png"),
  "recurring-created": require("@/assets/illustrations/feedback/recurring-created.png"),
  "draft-finalized": require("@/assets/illustrations/feedback/draft-finalized.png"),
  "password-reset": require("@/assets/illustrations/feedback/password-reset.png"),
  "onboarding-completed": require("@/assets/illustrations/feedback/onboarding-completed.png"),
  "onboarding-joined": require("@/assets/illustrations/feedback/onboarding-joined.png")
} satisfies Record<ActionFeedbackKind | "pro-activated" | "pro-restored", ImageSourcePropType>;

export function getFeedbackIllustration(kind?: string): ImageSourcePropType {
  return kind && Object.hasOwn(FEEDBACK_ILLUSTRATIONS, kind)
    ? FEEDBACK_ILLUSTRATIONS[kind as keyof typeof FEEDBACK_ILLUSTRATIONS]
    : FEEDBACK_ILLUSTRATIONS["settlement-completed"];
}
