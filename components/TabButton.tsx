import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { LucideIcon } from 'lucide-react-native';
import Icon from './Icon';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { VStack } from './ui/vstack';

export default function TabButton(
  props: BottomTabBarButtonProps & { label: string; icon: LucideIcon }
) {
  const {
    onPress,
    accessibilityState,
    accessibilityLabel,
    testID,
    label,
    icon
  } = props;
  const isActive = props['aria-selected'];

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
          className={isActive ? 'text-primary-400' : 'text-secondary-950'}
        />
        <Text
          size="sm"
          className={isActive ? 'text-primary-400' : 'text-secondary-950'}
        >
          {label}
        </Text>
      </Button>
    </VStack>
  );
}
