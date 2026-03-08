import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";
import Icon from "./Icon";
import { Box } from "./ui/box";
import { Button } from "./ui/button";
import { Image } from "./ui/image";
import { Pressable } from "./ui/pressable";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

const UploadImage = ({
  title = "Upload Image",
  subtitle,
  onSelect
}: {
  title: string;
  subtitle?: string;
  onSelect: (result: ImagePicker.ImagePickerSuccessResult) => void;
}) => {
  const [image, setImage] = useState<string | null>(null);

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
      mediaTypes: ["images"],
      shape: "rectangle",
      quality: 1
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      onSelect(result);
    }
  };

  if (!image) {
    return (
      <Pressable
        onPress={pickImage}
        className="border-dashed border-2 border-background-200 rounded-3xl h-32 w-full justify-center items-center flex"
      >
        <VStack className="items-center gap-y-2">
          <Icon as="upload" size={36} />
          <Text className="text-secondary-950">{title}</Text>
          {subtitle && (
            <Text className="text-secondary-950 text-sm">{subtitle}</Text>
          )}
        </VStack>
      </Pressable>
    );
  }

  return (
    <Box className="relative w-full bg-background-100 rounded-3xl">
      <Image
        source={{ uri: image }}
        alt={title}
        resizeMode="contain"
        className="aspect-square h-auto w-full rounded-3xl"
      />
      <Button
        className="rounded-full p-0 h-[40] w-[40] absolute bottom-4 right-4"
        onPress={pickImage}
      >
        <Icon as="edit" className="text-background-0" />
      </Button>
    </Box>
  );
};

export default UploadImage;
