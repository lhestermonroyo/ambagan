import FormButton from '@/components/FormButton';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { Link } from '@/components/ui/link';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import services from '@/services';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await services.auth.logout();
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <KeyboardAvoidingView className="bg-primary-0 flex-1" behavior="padding">
      <ScrollView>
        <VStack className="p-4 gap-y-6">
          <HStack className="gap-x-2 mb-4">
            <Card className="flex-1 bg-green-500 rounded-xl">
              <VStack className="gap-y-4">
                <Text className="text-white text-xl">Owes You</Text>
                <Text bold className="text-white text-3xl">
                  ₱0.00
                </Text>
              </VStack>
            </Card>
            <Card className="flex-1 bg-red-500 rounded-xl">
              <VStack className="gap-y-4">
                <Text className="text-white text-xl">You Owe</Text>
                <Text bold className="text-white text-3xl">
                  ₱0.00
                </Text>
              </VStack>
            </Card>
          </HStack>

          <HStack className="items-center justify-between">
            <Text bold className="text-2xl flex-1">
              Recent Activities
            </Text>
            <Link>
              <Text className="text-primary-400">View All</Text>
            </Link>
          </HStack>
          <HStack className="items-center justify-between">
            <Text bold className="text-2xl flex-1">
              Groups
            </Text>
            <Link>
              <Text className="text-primary-400">View All</Text>
            </Link>
          </HStack>
          <FormButton text="Logout" onPress={handleLogout} />
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
