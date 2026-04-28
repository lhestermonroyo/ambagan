import SplashLoading from "@/components/SplashLoading";
import SplashScreen from "@/components/SplashScreen";
import services from "@/services";
import states from "@/states";
import { supabase } from "@/utils/supabase";
import { useRouter } from "expo-router";

import { useEffect, useState } from "react";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        states.user.setState((prev) => ({
          ...prev,
          session
        }));

        fetchUser(session?.user.id!);
      })
      .catch((error) => {
        console.log("Error getting session:", error);
        setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      states.user.setState((prev) => ({
        ...prev,
        session
      }));

      fetchUser(session?.user.id!);
    });

    return () => data.subscription && data.subscription.unsubscribe();
  }, []);

  const fetchUser = async (id: string) => {
    try {
      const response = await services.user.getUserById(id);

      if (!response) return;

      states.user.setState((prev) => ({
        ...prev,
        details: response
      }));
      router.push("/home");
    } catch (error) {
      console.log("Error fetching user:", error);
      states.user.setState((prev) => ({
        ...prev,
        session: null,
        details: null
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SplashLoading loading={loading}>
      <SplashScreen />
    </SplashLoading>
  );
}
