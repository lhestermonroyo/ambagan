import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import AppAvatar from "./AppAvatar";
import FormButton from "./FormButton";
import Icon from "./Icon";
import { Box } from "./ui/box";
import { Pressable } from "./ui/pressable";
import { VStack } from "./ui/vstack";

const UploadAvatar = ({
  defaultAvatar,
  onSelect
}: {
  defaultAvatar?: string;
  onSelect: (result: ImagePicker.ImagePickerSuccessResult) => void;
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
    <VStack>
      <Pressable onPress={pickImage} className="items-center">
        {image ? (
          <Box className="border-primary-500 border-2 rounded-full">
            <AppAvatar name="A" className="h-[64] w-[64]" uri={image} />
          </Box>
        ) : (
          <Pressable onPress={pickImage} className="items-center">
            <Box className="border-2 border-background-200 rounded-full h-[64] w-[64] justify-center items-center">
              <Icon as="upload" size={24} />
            </Box>
          </Pressable>
        )}
      </Pressable>
      <FormButton
        onPress={pickImage}
        size="md"
        text={image ? "Change Avatar" : "Upload Avatar"}
        variant="link"
      />
    </VStack>
  );
};

export default UploadAvatar;
