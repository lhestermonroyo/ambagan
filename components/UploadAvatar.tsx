import AppAvatar from "@/components/AppAvatar";
import ImagePickerSheet from "@/components/ImagePickerSheet";
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import { getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import * as ImagePicker from "expo-image-picker";
import { Upload } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AppButton from "./FormButton";
import { Box } from "./ui/box";
import { VStack } from "./ui/vstack";

const UploadAvatar = ({
  defaultAvatar,
  onSelect,
  type = "default",
  pending = false
}: {
  defaultAvatar?: string;
  onSelect: (result: ImagePicker.ImagePickerSuccessResult) => void;
  type?: "onboarding" | "default";
  pending?: boolean;
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const colorScheme = useColorScheme() ?? "light";
  const { isOnline } = useNetwork();
  const toast = useAppToast();

  useEffect(() => {
    setImage(defaultAvatar || null);
  }, [defaultAvatar]);

  // Images upload to storage, which needs a connection. Block the picker offline
  // and tell the user; the surrounding form can still be saved without an image.
  const openPicker = () => {
    if (!isOnline) {
      toast({
        title: "You're offline",
        description:
          "Images can't be uploaded right now. You can still save without one.",
        type: "info"
      });
      return;
    }
    setSheetOpen(true);
  };

  const handleSelect = (result: ImagePicker.ImagePickerSuccessResult) => {
    setImage(result.assets[0].uri);
    onSelect(result);
  };

  return (
    <VStack className="gap-y-4 items-center">
      {image ? (
        <Box className="rounded-full">
          <AppAvatar name="A" className="h-[100] w-[100]" uri={image} />
        </Box>
      ) : (
        <Box
          className={cn(
            "border-2 border-background-200 bg-background-50 rounded-full justify-center items-center h-[100] w-[100]"
          )}
        >
          <Upload
            size={24}
            color={getSecondaryHex("text-secondary-950", colorScheme)}
          />
        </Box>
      )}
      {!pending && (
        <AppButton
          onPress={openPicker}
          size="sm"
          className="self-center rounded-full"
          text={image ? "Change" : "Upload"}
          variant="outline"
        />
      )}

      <ImagePickerSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={handleSelect}
        options={{
          allowsEditing: true,
          aspect: [1, 1],
          mediaTypes: ["images"]
        }}
      />
    </VStack>
  );
};

export default UploadAvatar;
