import SplashLoading from "@/components/SplashLoading";
import states from "@/states";

export default function Index() {
  const { routeIntent } = states.user();

  switch (routeIntent) {
    // case "tabs":
    //   return <Redirect href="/(tabs)/(home)" />;
    // case "onboarding":
    //   return <Redirect href="/onboarding" />;
    // case "login":
    // case "welcome":
    //   return <Redirect href="/(auth)/welcome" />;
    default:
      return <SplashLoading loading />;
  }
}
