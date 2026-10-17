import FeatureTourCarousel from "@/features/user/components/FeatureTour/FeatureTourCarousel";
import useUserState from "@/features/user/states/user.state";
import { setTourSeen } from "@/utils/featureTour";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * The "what you can do here" tour, presented as a modal over the tabs.
 *
 * A route rather than a component behind a boolean so the native swipe-down
 * dismiss and Android back come for free, and so Profile → How Ambagan works
 * can reopen it later — a tour you can only ever see once is wasted work.
 *
 * Headerless on purpose: the root Stack's `headerShown: false` carries over, and
 * the tour draws its own Skip button. A native header put a second, empty title
 * bar above artwork that already fills the card.
 */
export default function FeatureTourScreen() {
  const router = useRouter();
  const userId = useUserState((state) => state.details?.id ?? state.session?.user.id);

  // Persist when the tour opens: a full reload or process exit can skip React
  // cleanup entirely. Subscribe to the user so this also works when a restored
  // tour route mounts before the account finishes loading.
  useEffect(() => {
    if (userId) void setTourSeen(userId);
  }, [userId]);

  return (
    <SafeAreaView className="flex-1 bg-background-0" edges={["top", "bottom"]}>
      <FeatureTourCarousel onDone={() => router.back()} />
    </SafeAreaView>
  );
}
