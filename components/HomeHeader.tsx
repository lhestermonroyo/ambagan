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
    <View className="bg-primary-400 px-4 pb-4 pt-16">
      <HStack className="gap-x-2 items-center">
        <VStack className="flex-1">
          <Text className="text-white">Hello,</Text>
          <Text bold className="text-2xl text-white">
            {auth.user?.first_name} {auth.user?.last_name}
          </Text>
        </VStack>x
        <Button variant="link" className="rounded-full p-6 h-[18] w-[18]">
          <Icon as={Bell} />
        </Button>
      </HStack>
    </View>
  );
}
