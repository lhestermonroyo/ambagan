import { MaterialIcons } from "@expo/vector-icons";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import Icon from "./Icon";
import { Button } from "./ui/button";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

export default function TabButton(
  props: BottomTabBarButtonProps & {
    label: string;
    icon: React.ComponentProps<typeof MaterialIcons>["name"];
  }
) {
  const {
    onPress,
    accessibilityState,
    accessibilityLabel,
    testID,
    label,
    icon
  } = props;
  const isActive = props["aria-selected"];

  return (
    <VStack className="items-center justify-center py-2">
      <Button
        variant="link"
        className="flex flex-col gap-y-1"
        onPress={onPress}
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <Icon
          as={icon}
          size={28}
          className={isActive ? "text-primary-400" : "text-secondary-950"}
        />
        <Text
          size="sm"
          className={isActive ? "text-primary-400" : "text-secondary-950"}
        >
          {label}
        </Text>
      </Button>
    </VStack>
  );
}
