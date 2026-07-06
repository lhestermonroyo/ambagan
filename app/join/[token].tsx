import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import services from "@/services";
import states from "@/states";
import * as offlineQueue from "@/utils/offlineQueue";
import {
  clearPendingInviteToken,
  setPendingInviteToken
} from "@/utils/pendingInvite";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export default function JoinGroupScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
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
    <SafeAreaView style={{ flex: 1 }}>
      <VStack className="flex-1 items-center justify-center gap-y-4 p-6">
        {status === "joining" ? (
          <>
            <Spinner size="large" />
            <Text className="text-secondary-500 text-center">
              Joining group…
            </Text>
          </>
        ) : (
          <Text className="text-center text-error-500">{errorMsg}</Text>
        )}
      </VStack>
    </SafeAreaView>
  );
}
