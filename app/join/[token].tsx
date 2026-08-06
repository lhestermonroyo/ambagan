import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useHideSplashOnFirstFrame } from "@/hooks/useHideSplash";
import services from "@/services";
import states from "@/states";
import { getErrorHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import {
  clearPendingInviteToken,
  setPendingInviteToken
} from "@/utils/pendingInvite";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function JoinGroupScreen() {
  // An invite deep link cold-launches straight here, bypassing app/index — so
  // this screen has to lift the splash itself or the watchdog would hold it for
  // the full timeout.
  useHideSplashOnFirstFrame();

  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const [status, setStatus] = useState<"joining" | "error">("joining");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Invalid invite link.");
      return;
    }
    handleJoin(token);
  }, [token]);

  const handleJoin = async (inviteToken: string) => {
    const { session, details } = states.user.getState();

    if (!session) {
      // Not logged in — stash the token, go to welcome/login
      await setPendingInviteToken(inviteToken);
      router.replace("/(auth)/welcome" as any);
      return;
    }

    if (!details) {
      // Logged in but hasn't completed onboarding yet
      await setPendingInviteToken(inviteToken);
      router.replace("/(auth)/onboarding");
      return;
    }

    // Joining is server-only. Guard here too (not just at the scan entry) so a
    // deep-link / pending-invite arrival while offline shows a clear message
    // instead of an indefinite "Joining group…" spinner (writes aren't timed
    // out by the degraded-network wrapper, so the request would just hang).
    if (!(await offlineQueue.isOnline())) {
      setStatus("error");
      setErrorMsg(
        "You're offline. Connect to the internet and open this invite link again to join."
      );
      return;
    }

    try {
      const groupId = await services.group.joinGroupByToken(inviteToken);
      await clearPendingInviteToken();

      // Refresh the cached group list so the just-joined group — now with the
      // current user as a member — is immediately present for the rest of the
      // app (e.g. the expense form's default-group pick) instead of only after
      // a tab refocuses and refetches. Non-fatal: fall through to navigation if
      // it fails; the list will refresh on next focus.
      if (details?.id) {
        try {
          const groups = await services.group.getGroupsByUserId(details.id);
          states.group.setState((prev) => ({ ...prev, list: groups }));
        } catch {
          // ignore — next focus will refetch
        }
      }

      router.replace(`/groups/${groupId}` as any);
    } catch (error: any) {
      setStatus("error");
      setErrorMsg(
        error?.message?.includes("Invalid")
          ? "This invite link is invalid or has expired."
          : "Failed to join the group. Please try again."
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-secondary-0">
      <VStack className="flex-1 items-center justify-center gap-y-4 p-6">
        {status === "joining" ? (
          <>
            <Spinner size="large" />
            <Text className="text-secondary-500 text-center">
              Joining group…
            </Text>
          </>
        ) : (
          <VStack className="w-full items-center gap-y-5">
            <Box className="h-16 w-16 items-center justify-center rounded-full bg-error-50">
              <AlertCircle
                size={32}
                color={getErrorHex("text-error-500", colorScheme)}
              />
            </Box>
            <VStack className="gap-y-1">
              <Text bold className="text-xl text-center">
                Couldn&apos;t join group
              </Text>
              <Text className="text-center text-secondary-950">{errorMsg}</Text>
            </VStack>
            <FormButton
              className="w-full"
              text="Back to Overview"
              onPress={() => router.replace("/(tabs)/(home)")}
            />
          </VStack>
        )}
      </VStack>
    </SafeAreaView>
  );
}
