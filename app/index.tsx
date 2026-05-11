import SplashLoading from "@/components/SplashLoading";
import states from "@/states";
import { Redirect } from "expo-router";

export default function Index() {
  const { session, loading } = states.user();

  return (
    <SplashLoading loading={loading}>
      {session ? (
        <Redirect href="/(tabs)" />
      ) : (
        <Redirect href="/(auth)/welcome" />
      )}
    </SplashLoading>
  );
}
