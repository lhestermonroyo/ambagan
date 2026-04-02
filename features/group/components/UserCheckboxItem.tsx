import AppAvatar from "@/components/AppAvatar";
import {
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator
} from "@/components/ui/checkbox";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { User } from "@/types/user";
import { CheckIcon } from "lucide-react-native";

export function UserCheckboxItem({
  item,
  disabled = false
}: {
  item: User;
  disabled?: boolean;
}) {
  const { details: userDetails } = states.user();
  const isCreator = item.id === userDetails?.id;

  return (
    <Checkbox
      size="lg"
      key={item.id}
      value={item.id.toString()}
      isDisabled={disabled}
      className="px-4 justify-between"
    >
      <VStack className="flex-1 gap-y-4 py-4">
        <HStack className="items-center">
          <HStack className="gap-x-2 items-center flex-1">
            <AppAvatar name={item.first_name} uri={item.avatar!} size="md" />
            <VStack>
              <Text className="text-lg">
                {item?.first_name} {item?.last_name} {isCreator && "(Creator)"}
              </Text>
              <Text className="text-secondary-950">{item?.email}</Text>
            </VStack>
          </HStack>
          <CheckboxIndicator>
            <CheckboxIcon as={CheckIcon} />
          </CheckboxIndicator>
        </HStack>
      </VStack>
    </Checkbox>
  );
}
