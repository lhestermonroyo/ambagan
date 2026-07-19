import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Image } from "@/components/ui/image";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { statusCodes } from "@react-native-google-signin/google-signin";
import type { Session } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { Platform } from "react-native";

type Provider = "google" | "apple";

/**
 * "or continue with" divider + Google / Apple sign-in buttons. Dropped below the
 * form on the login and sign-up screens. Both providers use the native ID-token
 * flow (auth.service.ts) → a Supabase session, then hand off to the existing
 * routeIntent machinery: setting routeIntent "splash" and replacing to "/" lets
 * app/index.tsx wait for fetchDetails to decide onboarding (new user) vs tabs
 * (returning user), instead of flashing a stale route.
 */
export default function SocialAuthButtons() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const router = useRouter();
  const toast = useAppToast();
  const { colorScheme } = useColorScheme();

  const routeAfterSignIn = (
    session: Session,
    name: { firstName: string; lastName: string } | null
  ) => {
    states.user.setState((prev) => ({
      ...prev,
      session,
      // Only a name with something in it is worth pre-filling onboarding with.
      oauthName: name?.firstName || name?.lastName ? name : prev.oauthName,
      routeIntent: "splash"
    }));
    router.replace("/");
  };

  const showError = (provider: Provider) =>
    toast({
      title: "Sign In Failed",
      description: `Couldn't sign in with ${
        provider === "google" ? "Google" : "Apple"
      }. Please try again.`,
      type: "error"
    });

  const handleGoogle = async () => {
    setLoadingProvider("google");
    try {
      const data = await services.auth.signInWithGoogle();
      if (!data) return; // user dismissed the picker
      if (!data.session) throw new Error("No session returned from Google");

      const meta = (data.user?.user_metadata ?? {}) as Record<string, string>;
      const fullName = meta.name ?? meta.full_name ?? "";
      const name = {
        firstName: meta.given_name ?? fullName.split(" ")[0] ?? "",
        lastName:
          meta.family_name ?? fullName.split(" ").slice(1).join(" ") ?? ""
      };

      routeAfterSignIn(data.session, name);
    } catch (error: any) {
      if (
        error?.code === statusCodes.SIGN_IN_CANCELLED ||
        error?.code === statusCodes.IN_PROGRESS
      ) {
        return;
      }
      console.log("Google sign-in error:", error);
      showError("google");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleApple = async () => {
    setLoadingProvider("apple");
    try {
      const { data, fullName } = await services.auth.signInWithApple();
      if (!data.session) throw new Error("No session returned from Apple");

      routeAfterSignIn(data.session, {
        firstName: fullName?.givenName ?? "",
        lastName: fullName?.familyName ?? ""
      });
    } catch (error: any) {
      if (error?.code === "ERR_REQUEST_CANCELED") return; // user cancelled
      console.log("Apple sign-in error:", error);
      showError("apple");
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <>
      <HStack className="items-center gap-x-3">
        <Box className="flex-1 h-px bg-secondary-200" />
        <Text className="text-sm text-secondary-950">or continue with</Text>
        <Box className="flex-1 h-px bg-secondary-200" />
      </HStack>
      <VStack className="gap-y-4">
        <FormButton
          variant="outline"
          action="secondary"
          text="Continue with Google"
          loading={loadingProvider === "google"}
          disabled={!!loadingProvider}
          icon={
            <Image
              source={require("@/assets/images/google-logo.png")}
              className="w-5 h-5"
              alt="Google"
              resizeMode="contain"
            />
          }
          onPress={handleGoogle}
        />

        {/* Native Sign in with Apple is iOS-only (Android sees Google only). Gate
          on Platform.OS — Apple auth is available on every iOS 13+ device, and
          the async isAvailableAsync() probe was flip-flopping under the React
          Compiler / dev remounts and hiding the button. alignSelf:"stretch"
          (not width:"100%") makes the native button fill the row reliably. */}
        {Platform.OS === "ios" && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
            }
            buttonStyle={
              colorScheme === "dark"
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={9999}
            style={{
              height: 42,
              alignSelf: "stretch"
            }}
            onPress={handleApple}
          />
        )}
      </VStack>
    </>
  );
}
