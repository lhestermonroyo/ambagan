import * as ImagePicker from 'expo-image-picker';
import { Edit2, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { Alert } from 'react-native';
import Icon from './Icon';
import { Box } from './ui/box';
import { Button } from './ui/button';
import { Image } from './ui/image';
import { Pressable } from './ui/pressable';
import { Text } from './ui/text';
import { VStack } from './ui/vstack';

const UploadCoverPhoto = ({
  onSelect
}: {
  onSelect: (uri: string) => void;
}) => {
  const [image, setImage] = useState<string | null>(null);

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission required',
        'Permission to access the media library is required.'
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1
    });

    console.log(result);

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      onSelect(result.assets[0].uri);
    }
  };

  if (!image) {
    return (
      <Pressable
        onPress={pickImage}
        className="border-dashed border-2 border-secondary-800 rounded-3xl aspect-[16/9] w-full justify-center items-center flex"
      >
        <VStack className="items-center gap-y-2">
          <Icon as={Upload} className="text-secondary-950" size={36} />
          <Text className="text-secondary-950">Add Cover Photo</Text>
        </VStack>
      </Pressable>
    );
  }

  return (
    <Box className="relative w-full">
      <Image
        source={{ uri: image }}
        alt="Cover Photo"
        resizeMode="cover"
        className="aspect-[16/9] h-auto w-full rounded-3xl"
      />
      <Button
        className="rounded-full p-6 h-[18] w-[18] absolute bottom-4 right-4"
        onPress={pickImage}
      >
        <Icon as={Edit2} />
      </Button>
    </Box>
  );
};

export default UploadCoverPhoto;
