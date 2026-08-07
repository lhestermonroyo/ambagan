import FeatureTourCarousel from "@/features/user/components/FeatureTour/FeatureTourCarousel";
import states from "@/states";
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
 */
export default function FeatureTourScreen() {
  const router = useRouter();

  // Marked seen on unmount, which is the one place every way out converges:
  // Skip, "Get started", swipe-down, and Android back. Anything finer-grained
  // would leave a dismissal path that re-nags on the next launch.
  //
  // The id is read from the store at teardown rather than subscribed to, so the
  // effect can stay mount-scoped — keyed on the id it would write the flag
  // early on any identity change while the tour is still open.
  useEffect(() => {
    return () => {
      const id = states.user.getState().details?.id;
      if (id) setTourSeen(id);
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background-0" edges={["top", "bottom"]}>
      <FeatureTourCarousel onDone={() => router.back()} />
    </SafeAreaView>
  );
}
