import AppAvatar from "@/components/AppAvatar";
import {
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator
} from "@/components/ui/checkbox";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { UserPreview } from "@/types/user";
import { getSecondaryHex } from "@/utils/getColorHex";
import { CheckIcon, Heart } from "lucide-react-native";

export function UserCheckboxItem({
  item,
  disabled = false
}: {
  item: UserPreview;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      size="lg"
      key={item.id}
      value={item.id.toString()}
      isDisabled={disabled}
      className="px-4 justify-between"
    >
      <VStack className="flex-1 gap-y-4 py-4">
        <HStack className="items-center gap-x-4 ">
          <CheckboxIndicator>
            <CheckboxIcon as={CheckIcon} />
          </CheckboxIndicator>
          <HStack className="gap-x-2 items-center flex-1">
            <AppAvatar name={item.first_name} uri={item.avatar!} size="md" />
            <VStack>
              <Text className="text-lg">
                {item?.first_name} {item?.last_name}
              </Text>
              <Text className="text-secondary-950">{item?.email}</Text>
            </VStack>
          </HStack>
          <Pressable>
            <Heart color={getSecondaryHex("text-secondary-950")} />
          </Pressable>
        </HStack>
      </VStack>
    </Checkbox>
  );
}
