import AppAvatar from "@/components/AppAvatar";
import { getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import * as ImagePicker from "expo-image-picker";
import { Upload } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import AppButton from "./FormButton";
import { Box } from "./ui/box";
import { VStack } from "./ui/vstack";

const UploadAvatar = ({
  defaultAvatar,
  onSelect,
  type = "default"
}: {
  defaultAvatar?: string;
  onSelect: (result: ImagePicker.ImagePickerSuccessResult) => void;
  type?: "onboarding" | "default";
}) => {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    setImage(defaultAvatar || null);
  }, [defaultAvatar]);

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission required",
        "Permission to access the media library is required."
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      onSelect(result);
    }
  };

  return (
    <VStack className="gap-y-4 items-center">
      {image ? (
        <Box className="border-2 border-background-200 rounded-full">
          <AppAvatar name="A" className="h-[100] w-[100]" uri={image} />
        </Box>
      ) : (
        <Box
          className={cn(
            "border-2 border-background-200 rounded-full justify-center items-center h-[100] w-[100]"
          )}
        >
          <Upload size={24} color={getSecondaryHex("text-secondary-950")} />
        </Box>
      )}
      <AppButton
        onPress={pickImage}
        size="sm"
        className="self-center rounded-full"
        text={image ? "Change Avatar" : "Upload Avatar"}
        variant="outline"
      />
    </VStack>
  );
};

export default UploadAvatar;
