import { View } from '@/components/ui/view';
import states from '@/states';
import { BottomTabHeaderProps } from '@react-navigation/bottom-tabs';
import { Bell } from 'lucide-react-native';
import Icon from './Icon';
import { Button } from './ui/button';
import { HStack } from './ui/hstack';
import { Text } from './ui/text';
import { VStack } from './ui/vstack';

export default function HomeHeader(props: BottomTabHeaderProps) {
  const auth = states.auth((state) => state);

  return (
    <View className="bg-white px-4 pb-4 pt-16">
      <HStack className="gap-x-2 items-center">
        <VStack className="flex-1">
          <Text className="text-secondary-950">Hello,</Text>
          <Text bold className="text-2xl">
            {auth.user?.first_name} {auth.user?.last_name}
          </Text>
        </VStack>
        <Button variant="outline" className="rounded-full p-6 h-[18] w-[18]">
          <Icon as={Bell} className="text-primary-400" />
        </Button>
      </HStack>
    </View>
  );
}
