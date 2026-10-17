import SuccessFeedback from "@/components/SuccessFeedback";
import { getActionFeedback } from "@/constants/actionFeedback";
import { useActionFeedbackState } from "@/features/user/states/actionFeedback.state";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

export default function ActionSuccessScreen() {
  const { kind, feedbackId } = useLocalSearchParams<{
    kind?: string;
    feedbackId?: string;
  }>();
  const router = useRouter();

  // Button, native swipe, and Android back all release the first-run overlay
  // gate here, after this route unmounts. No completion action lives on Close.
  useEffect(() => () => {
    if (feedbackId) useActionFeedbackState.getState().clear(feedbackId);
  }, [feedbackId]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/(home)");
  };

  return <SuccessFeedback {...getActionFeedback(kind)} onClose={close} />;
}
