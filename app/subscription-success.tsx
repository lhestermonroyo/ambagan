import SuccessFeedback from "@/components/SuccessFeedback";
import { getFeedbackIllustration } from "@/constants/feedbackIllustrations";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function SubscriptionSuccessScreen() {
  const { plan, restored } = useLocalSearchParams<{
    plan?: string;
    restored?: string;
  }>();
  const router = useRouter();
  const isRestored = restored === "1";
  const description = isRestored
    ? "Your Pro access is restored. Enjoy unlimited daily expenses and all your Pro features again."
    : plan === "two_week"
      ? "Your 2-week Pro pass is active. Enjoy unlimited daily expenses and all Pro features, with no auto-renewal."
      : plan === "yearly"
        ? "Your yearly Pro subscription is active. Enjoy unlimited daily expenses and all Pro features."
        : "Your monthly Pro subscription is active. Enjoy unlimited daily expenses and all Pro features.";

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/profile/subscription");
  };

  return (
    <SuccessFeedback
      title={isRestored ? "Your Pro Access Is Restored" : "Welcome to Pro!"}
      description={description}
      illustration={getFeedbackIllustration(isRestored ? "pro-restored" : "pro-activated")}
      onClose={close}
    />
  );
}
