import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadAvatar from "@/components/UploadAvatar";
import EditNameSheet from "@/features/profile/components/EditNameSheet";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { User } from "@/types/user";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function PersonalInfoScreen() {
  const { details: userDetails } = states.user();
  const router = useRouter();
  const toast = useAppToast();

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [pendingAvatar, setPendingAvatar] =
    useState<ImagePickerSuccessResult | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const fullName =
    `${userDetails?.first_name ?? ""} ${userDetails?.last_name ?? ""}`.trim();

  const handleAvatarSelect = (result: ImagePickerSuccessResult) => {
    setPendingAvatar(result);
  };

  const handleSaveAvatar = async () => {
    if (!pendingAvatar) return;

    setSavingAvatar(true);
    try {
      const response = await services.user.updateAvatar(pendingAvatar);

      states.user.setState((prev) => ({
        ...prev,
        details: response.data as User
      }));

      setPendingAvatar(null);
      toast({
        title: "Avatar Updated",
        description: "Your avatar has been updated successfully.",
        type: "success"
      });
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast({
        title: "Error",
        description: "Failed to update avatar. Please try again.",
        type: "error"
      });
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleCancelAvatar = () => {
    setPendingAvatar(null);
  };

  return (
    <InnerLayout title="Personal Info" onBack={() => router.back()}>
      <ScrollView className="flex-1" bounces={false}>
        <VStack className="gap-y-8 p-4">
          <VStack className="items-center pt-4 pb-2 gap-y-4">
            <UploadAvatar
              defaultAvatar={
                pendingAvatar
                  ? pendingAvatar.assets[0].uri
                  : userDetails?.avatar || undefined
              }
              onSelect={handleAvatarSelect}
              pending={!!pendingAvatar}
            />
            {pendingAvatar && (
              <HStack className="gap-x-2">
                <FormButton
                  size="sm"
                  variant="outline"
                  text="Cancel"
                  disabled={savingAvatar}
                  onPress={handleCancelAvatar}
                />
                <FormButton
                  size="sm"
                  text="Save Changes"
                  loading={savingAvatar}
                  onPress={handleSaveAvatar}
                />
              </HStack>
            )}
          </VStack>

          <Box className="bg-secondary-100 rounded-xl overflow-hidden">
            <DetailRow
              label="Name"
              value={fullName || "—"}
              onPress={() => setEditNameOpen(true)}
            />
            <Box className="mx-4">
              <Divider className="text-secondary-200" />
            </Box>
            <DetailRow
              label="Email"
              value={userDetails?.email || "—"}
              readOnly
              onPress={() => {}}
            />
            <Box className="mx-4">
              <Divider className="text-secondary-200" />
            </Box>
            <DetailRow
              label="Phone"
              value={`+63 ${userDetails?.phone || "—"}`}
              readOnly
              onPress={() => {}}
            />
          </Box>
        </VStack>
      </ScrollView>

      <EditNameSheet
        isOpen={editNameOpen}
        onClose={() => setEditNameOpen(false)}
      />
    </InnerLayout>
  );
}

function DetailRow({
  label,
  value,
  readOnly = false,
  onPress
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableListItem onPress={onPress} className="bg-secondary-100 p-4">
      <HStack className="items-start gap-x-4 justify-between">
        <Box className="flex-1">
          <Text className="text-secondary-950">{label}</Text>
        </Box>
        <HStack style={{ flex: 2 }} className="w-full items-center justify-end">
          <Text>{value}</Text>
          {!readOnly && (
            <Icon as="chevron-right" className="text-secondary-950" />
          )}
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
