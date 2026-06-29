import ImagePickerSheet from "@/components/ImagePickerSheet";
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import { getSecondaryHex } from "@/utils/getColorHex";
import * as ImagePicker from "expo-image-picker";
import { Edit, Upload } from "lucide-react-native";
import { useState } from "react";
import { useColorScheme } from "react-native";
import { Box } from "./ui/box";
import { Button } from "./ui/button";
import { Image } from "./ui/image";
import { Pressable } from "./ui/pressable";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

const UploadImage = ({
  title = "Upload Image",
  subtitle,
  defaultUri = null,
  onSelect
}: {
  title: string;
  subtitle?: string;
  /** Existing image URL to display initially (e.g. when editing). */
  defaultUri?: string | null;
  onSelect: (result: ImagePicker.ImagePickerSuccessResult) => void;
}) => {
  const [image, setImage] = useState<string | null>(defaultUri);
  const [sheetOpen, setSheetOpen] = useState(false);
  const colorScheme = useColorScheme() ?? "light";
  const { isOnline } = useNetwork();
  const toast = useAppToast();

  const handleSelect = (result: ImagePicker.ImagePickerSuccessResult) => {
    setImage(result.assets[0].uri);
    onSelect(result);
  };

  // Uploading to storage needs a connection — block the picker offline and tell
  // the user; the expense itself can still be saved without a proof image.
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

  if (!image) {
    return (
      <>
        <Pressable
          onPress={openPicker}
          className="border-dashed border-2 border-background-200 rounded-3xl h-32 w-full justify-center items-center flex"
        >
          <VStack className="items-center gap-y-2">
            <Upload
              size={36}
              color={getSecondaryHex("text-secondary-950", colorScheme)}
            />
            <Text className="text-sm text-secondary-950">{title}</Text>
            {subtitle && (
              <Text className="text-secondary-950 text-sm">{subtitle}</Text>
            )}
          </VStack>
        </Pressable>

        <ImagePickerSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onSelect={handleSelect}
          options={{ mediaTypes: ["images"] }}
        />
      </>
    );
  }

  return (
    <>
      <Box className="relative w-full bg-background-100 rounded-3xl">
        <Image
          source={{ uri: image }}
          alt={title}
          resizeMode="contain"
          className="aspect-square h-auto w-full rounded-3xl"
        />
        <Button
          className="rounded-full p-0 h-[40] w-[40] absolute bottom-4 right-4"
          onPress={openPicker}
        >
          <Edit
            size={18}
            color={getSecondaryHex("text-secondary-0", colorScheme)}
          />
        </Button>
      </Box>

      <ImagePickerSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={handleSelect}
        options={{ mediaTypes: ["images"] }}
      />
    </>
  );
};

export default UploadImage;
