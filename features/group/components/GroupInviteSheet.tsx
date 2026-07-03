import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Copy, Download, Share2 } from "lucide-react-native";
import { useRef } from "react";
import { Share, useColorScheme } from "react-native";
import QRCode from "react-native-qrcode-svg";

const APP_SCHEME = "ambagan";

function buildInviteUrl(token: string): string {
  return `${APP_SCHEME}://join/${token}`;
}

export default function GroupInviteSheet({
  isOpen,
  onClose,
  groupName,
  inviteToken
}: {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  inviteToken: string;
}) {
  const toast = useAppToast();
  const colorScheme = useColorScheme() ?? "light";
  const inviteUrl = buildInviteUrl(inviteToken);
  const qrRef = useRef<any>(null);

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL(async (data: string) => {
      try {
        const filePath = `${FileSystem.cacheDirectory}ambagan-invite-qr.png`;
        await FileSystem.writeAsStringAsync(filePath, data, {
          encoding: FileSystem.EncodingType.Base64
        });
        await Sharing.shareAsync(filePath, {
          UTI: "public.image",
          mimeType: "image/png",
          dialogTitle: "Save QR Code"
        });
      } catch {
        toast({
          title: "Error",
          description: "Could not save QR code.",
          type: "error"
        });
      }
    });
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteUrl);
    toast({
      title: "Link copied",
      description: "Invite link copied to clipboard.",
      type: "success"
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my group "${groupName}" on Ambagan PH!\n\n${inviteUrl}`,
        title: `Join ${groupName} on Ambagan PH`
      });
    } catch {
      // user dismissed share sheet — ignore
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1">
          <Pressable onPress={onClose}>
            <HStack className="p-4 items-center">
              <Icon as="arrow-back-ios" className="text-secondary-950" />
              <Text bold className="text-xl">
                Share Group
              </Text>
            </HStack>
          </Pressable>

          <ScrollView className="flex-1 px-4">
            <VStack className="gap-y-6 pb-6">
              <VStack className="gap-y-2">
                <Text className="text-secondary-950">
                  Invite members by sharing the link to your group -{" "}
                  <Text bold>{groupName}</Text>. The link stays active until you
                  regenerate it.
                </Text>
              </VStack>

              <Box className="items-center py-4">
                <Box className="p-4 bg-white rounded-2xl">
                  <QRCode
                    value={inviteUrl}
                    size={200}
                    getRef={(ref) => (qrRef.current = ref)}
                  />
                </Box>
              </Box>

              <Divider className="border-secondary-100" />

              <FormControl size="md">
                <FormControlLabel>
                  <FormControlLabelText>Expense Date</FormControlLabelText>
                </FormControlLabel>
                <HStack className="gap-x-2 items-center bg-background-50 border border-secondary-200 rounded-lg px-3 py-3">
                  <Text
                    className="flex-1 text-sm text-secondary-700"
                    numberOfLines={1}
                  >
                    {inviteUrl}
                  </Text>
                  <Pressable onPress={handleCopy}>
                    <Copy
                      size={18}
                      color={getPrimaryHex("text-primary-500", colorScheme)}
                    />
                  </Pressable>
                </HStack>
              </FormControl>

              <HStack className="gap-x-2">
                <FormButton
                  className="flex-1"
                  text="Share Invite Link"
                  onPress={handleShare}
                  icon={
                    <Share2
                      size={18}
                      color={getSecondaryHex("text-secondary-0", colorScheme)}
                    />
                  }
                />
                <FormButton
                  className="flex-1"
                  variant="outline"
                  text="Download QR"
                  onPress={handleDownloadQR}
                  icon={
                    <Download
                      size={18}
                      color={getPrimaryHex("text-primary-500", colorScheme)}
                    />
                  }
                />
              </HStack>
            </VStack>
          </ScrollView>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
