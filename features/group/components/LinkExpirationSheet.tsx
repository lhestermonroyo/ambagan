import FormButton from "@/components/FormButton";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import {
  Radio,
  RadioGroup,
  RadioIcon,
  RadioIndicator
} from "@/components/ui/radio";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import services from "@/services";
import states from "@/states";
import { formatDistanceToNow } from "date-fns";
import { CircleIcon } from "lucide-react-native";
import { useEffect, useState } from "react";

const EXPIRY_OPTIONS: { label: string; ttl: number | null }[] = [
  { label: "Never", ttl: null },
  { label: "1 hour", ttl: 60 * 60 },
  { label: "24 hours", ttl: 24 * 60 * 60 },
  { label: "7 days", ttl: 7 * 24 * 60 * 60 }
];

// RadioGroup values must be strings; map ttl <-> a stable key.
const ttlKey = (ttl: number | null) => (ttl === null ? "never" : String(ttl));

export default function LinkExpirationSheet({
  isOpen,
  onClose,
  groupId
}: {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}) {
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();
  const [selectedTtl, setSelectedTtl] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);

  // Reset the selection to "Never" each time the sheet opens.
  useEffect(() => {
    if (isOpen) setSelectedTtl(null);
  }, [isOpen]);

  const handleReset = async () => {
    // Rotating the token is an online-only admin action (RPC write). Bail with
    // the standard offline toast instead of letting the request hang.
    if (
      !(await ensureOnline(
        "Resetting the invite link needs an internet connection. Please try again when you're back online."
      ))
    ) {
      return;
    }

    setResetting(true);
    try {
      const result = await services.group.resetGroupInvite(
        groupId,
        selectedTtl
      );
      // Push the fresh token/expiry into group state so the QR + status
      // (and anywhere else reading group details) update immediately.
      states.group.setState((prev) => ({
        ...prev,
        details: prev.details
          ? {
              ...prev.details,
              invite_token: result.invite_token,
              invite_token_expires_at: result.invite_token_expires_at
            }
          : prev.details
      }));
      toast({
        title: "Invite link reset",
        description:
          selectedTtl === null
            ? "A new link was generated. The old one no longer works."
            : `A new link was generated and expires ${formatDistanceToNow(
                new Date(result.invite_token_expires_at as string),
                { addSuffix: true }
              )}. The old one no longer works.`,
        type: "success"
      });
      onClose();
    } catch {
      toast({
        title: "Couldn't reset link",
        description: "Please check your connection and try again.",
        type: "error"
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4 pb-2">
          <VStack className="gap-y-1">
            <Text bold className="text-xl">
              Link Expiration
            </Text>
            <Text className="text-sm text-secondary-950">
              Choose how long the new link and QR stay valid. Resetting stops
              the current link immediately.
            </Text>
          </VStack>

          <RadioGroup
            value={ttlKey(selectedTtl)}
            onChange={(value) =>
              setSelectedTtl(value === "never" ? null : Number(value))
            }
          >
            <FlatList
              data={EXPIRY_OPTIONS}
              keyExtractor={(item) => item.label}
              scrollEnabled={false}
              renderItem={({ item: option }) => (
                <Radio
                  value={ttlKey(option.ttl)}
                  size="md"
                  className="justify-between py-4"
                >
                  <Text className="text-lg">{option.label}</Text>
                  <RadioIndicator>
                    <RadioIcon as={CircleIcon} />
                  </RadioIndicator>
                </Radio>
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-0">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
            />
          </RadioGroup>

          <FormButton
            text={resetting ? "Resetting…" : "Reset Link"}
            onPress={handleReset}
            loading={resetting}
          />
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
