import SplashLoading from "@/components/SplashLoading";
import states from "@/states";
import { Redirect } from "expo-router";

export default function Index() {
  const { routeIntent } = states.user();

  switch (routeIntent) {
    case "tabs":
      return <Redirect href="/(tabs)" />;
    case "onboarding":
      return <Redirect href="/onboarding" />;
    case "login":
      return <Redirect href="/(auth)/login" />;
    case "welcome":
      return <Redirect href="/(auth)/welcome" />;
    default:
      // "splash" — auth/profile still resolving; hold on the splash so we never
      // flash the wrong screen.
      return <SplashLoading loading />;
  }
}
