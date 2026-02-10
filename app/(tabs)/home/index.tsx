import FormButton from '@/components/FormButton';
import Icon from '@/components/Icon';
import {
  Avatar,
  AvatarFallbackText,
  AvatarImage
} from '@/components/ui/avatar';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { Link } from '@/components/ui/link';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import services from '@/services';
import states from '@/states';
import { TransactionPreview } from '@/types/transactions';
import { useRouter } from 'expo-router';
import { Bell, Plus, UserPlus } from 'lucide-react-native';

export default function HomeScreen() {
  const auth = states.auth.getState();
  const transaction = states.transaction.getState();

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
      <Box className="sticky top-0 bg-primary-400 px-4 pb-4 pt-20">
        <HStack className="gap-x-2 items-center">
          <VStack className="flex-1">
            <Text className="text-white">Hello,</Text>
            <Text bold className="text-2xl text-white">
              {auth.user?.first_name} {auth.user?.last_name}
            </Text>
          </VStack>
          <Button className="rounded-full p-6 h-[18] w-[18]">
            <Icon as={Bell} />
          </Button>
        </HStack>
      </Box>
      <ScrollView>
        <Box className="bg-primary-400 px-4 pb-4">
          <VStack className="gap-y-4">
            <VStack className="gap-y-2">
              <StatItem type="RECEIVE" amount={0} />
              <StatItem type="PAY" amount={0} />
            </VStack>
            <HStack className="gap-x-2">
              <FormButton
                className="flex-1"
                icon={<Icon as={Plus} />}
                text="Add Expense"
                onPress={() => router.push('/(tabs)/home/add-expense')}
              />
              <FormButton
                className="flex-1"
                text="Create Group"
                icon={<Icon as={UserPlus} />}
                onPress={() => router.push('/(tabs)/groups/create')}
              />
            </HStack>
          </VStack>
        </Box>
        <VStack className="p-4 gap-y-4">
          <Card className="rounded-xl p-0">
            <HStack className="p-4 border-b border-secondary-200 items-center justify-between">
              <Text bold className="text-xl flex-1">
                Recent Activities
              </Text>
              <Link onPress={() => router.push('/(tabs)/activity')}>
                <Text className="text-primary-400">View All</Text>
              </Link>
            </HStack>
            {transaction.preview.map((item) => (
              <ActivityItem key={item.id} data={item} />
            ))}
          </Card>
          <HStack className="items-center justify-between">
            <Text bold className="text-2xl flex-1">
              Active Groups
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

function StatItem({
  type,
  amount
}: {
  type: 'RECEIVE' | 'PAY';
  amount: number;
}) {
  return (
    <VStack className="py-4 flex-1">
      <VStack className=" gap-y-4">
        <Text className="text-white">
          {type === 'RECEIVE' ? 'Owes You' : 'You Owe'}
        </Text>
        <Text bold className="text-5xl text-white">
          ₱{amount.toFixed(2)}
        </Text>
      </VStack>
    </VStack>
  );
}

// display total amount of transaction and who created it
// display how much you owe or are owed based on type
// display if its settled or not
function ActivityItem({ data }: { data: TransactionPreview }) {
  return (
    <HStack className="p-4">
      <VStack className="w-full">
        <HStack className="gap-2">
          <HStack className="gap-x-2 items-center flex-1">
            <Avatar size="sm">
              <AvatarFallbackText>
                {data.created_by.first_name}
              </AvatarFallbackText>
              <AvatarImage
                source={{
                  uri: data.created_by?.avatar || undefined
                }}
              />
            </Avatar>
            <Text>
              {data.created_by.first_name} {data.created_by.last_name}
            </Text>
          </HStack>
          <VStack className="gap-2">
            <Badge
              size="lg"
              className="rounded-full"
              variant="solid"
              action={data.type === 'expense' ? 'error' : 'success'}
            >
              <BadgeText>
                {data.type === 'expense' ? `You owe` : `You are owed`} ₱
                {data.amount.toFixed(2)}
              </BadgeText>
            </Badge>
          </VStack>
        </HStack>
        {/* <Text bold className="text-lg">
          {data.description}
        </Text> */}
        <Text className="text-secondary-500"></Text>
      </VStack>
    </HStack>
  );
}
