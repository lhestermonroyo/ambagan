import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import PressableListItem from "@/components/PressableListItem";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getPrimaryHex } from "@/utils/getColorHex";
import * as ImagePicker from "expo-image-picker";
import { Camera, Images } from "lucide-react-native";
import { Alert, useColorScheme } from "react-native";

type ImagePickerOptions = {
  allowsEditing?: boolean;
  aspect?: [number, number];
  mediaTypes?: ImagePicker.MediaType[];
};

export default function ImagePickerSheet({
  isOpen,
  onClose,
  onSelect,
  options = {}
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: ImagePicker.ImagePickerSuccessResult) => void;
  options?: ImagePickerOptions;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const iconColor = getPrimaryHex("text-primary-400", colorScheme);
  const { allowsEditing = false, aspect, mediaTypes = ["images"] } = options;

  const handlePickFromLibrary = async () => {
    onClose();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Permission to access the photo library is required."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing,
      aspect,
      quality: 1
    });
    if (!result.canceled) onSelect(result);
  };

  const handleTakePhoto = async () => {
    onClose();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Permission to access the camera is required."
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes,
      allowsEditing,
      aspect,
      quality: 1
    });
    if (!result.canceled) onSelect(result);
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full">
          <VStack className="p-4">
            <Text bold className="text-xl">
              Upload Image
            </Text>
          </VStack>
          <PressableListItem onPress={handlePickFromLibrary}>
            <HStack className="p-4 gap-x-2 items-start justify-start">
              <Images color={iconColor} />
              <Text className="text-lg flex-1">Choose from Photos</Text>
              <Icon as="chevron-right" className="text-secondary-950 self-center" />
            </HStack>
          </PressableListItem>
          <ListDivider />
          <PressableListItem onPress={handleTakePhoto}>
            <HStack className="p-4 gap-x-2 items-start justify-start">
              <Camera color={iconColor} />
              <Text className="text-lg flex-1">Take a Photo</Text>
              <Icon as="chevron-right" className="text-secondary-950 self-center" />
            </HStack>
          </PressableListItem>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
