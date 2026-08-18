import UpdateAvailable from "@/features/user/components/UpdateAvailable";
import services from "@/services";
import states from "@/states";
import { snoozeUpdate } from "@/utils/updatePrompt";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * The "please update" screen, presented over whatever the user was doing.
 *
 * A route rather than a sheet behind a boolean, for the same reason as
 * feature-tour: the native swipe-down dismiss and Android back come for free in
 * the optional case, and the root Stack can turn both OFF in the required case
 * (see the `update-available` entry in app/_layout.tsx) — which a component
 * rendered inside a tab cannot do.
 *
 * Presentation is driven by `forced`: a plain `modal` when the update is merely
 * available, a non-dismissible `fullScreenModal` when the installed build is
 * below `min_supported_version`.
 */
export default function UpdateAvailableScreen() {
  const router = useRouter();
  const { forced } = useLocalSearchParams<{ forced?: string }>();
  const gate = states.appUpdate((s) => s.gate);

  // Belt and braces with the route param: `forced` decides the PRESENTATION
  // (which the layout needs before this component renders), the gate decides
  // the COPY. They agree in every real flow; if they ever didn't, the stricter
  // reading is the safe one.
  const required = forced === "1" || gate?.status === "required";

  // Android hardware back. `gestureEnabled: false` stops the iOS swipe but does
  // nothing for the back button, which would otherwise walk straight out of a
  // blocking screen.
  useEffect(() => {
    if (!required) return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [required]);

  // Snoozed on unmount, which is the one place every way out of an OPTIONAL
  // prompt converges: "Not now", swipe-down, and Android back. Handling only
  // the button would leave the two gesture dismissals re-prompting on the next
  // launch, which is how a nudge turns into nagging.
  //
  // Values are read from the store at teardown rather than closed over, so the
  // effect can stay mount-scoped — see the same pattern in feature-tour.tsx.
  // A required update never snoozes: there is nothing to dismiss.
  useEffect(() => {
    return () => {
      const pending = states.appUpdate.getState().gate;
      if (!pending || pending.status === "required") return;

      snoozeUpdate(pending.latestVersion);
      states.appUpdate.getState().setGate(null);
    };
  }, []);

  // Nothing to show — the gate was cleared out from under us (a hot reload, or
  // a re-entry after dismissal). Leave rather than render an empty screen.
  useEffect(() => {
    if (!gate && router.canGoBack()) router.back();
  }, [gate, router]);

  if (!gate) return null;

  return (
    <SafeAreaView className="flex-1 bg-background-0" edges={["top", "bottom"]}>
      <UpdateAvailable
        gate={gate}
        onUpdate={() => services.appVersion.openStorePage(gate.storeUrl)}
        onLater={required ? undefined : () => router.back()}
      />
    </SafeAreaView>
  );
}
