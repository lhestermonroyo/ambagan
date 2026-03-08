import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import {
  Avatar,
  AvatarFallbackText,
  AvatarImage
} from "@/components/ui/avatar";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { Link } from "@/components/ui/link";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import services from "@/services";
import states from "@/states";
import { TransactionPreview } from "@/types/transactions";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

export default function HomeScreen() {
  const user = states.user.getState();
  const transaction = states.transaction.getState();
  const group = states.group.getState();

  const router = useRouter();

  useEffect(() => {
    if (user.session) {
      fetchGroup();
    }
  }, [user.session]);

  const fetchGroup = async () => {
    try {
      const groups = await services.group.getGroupsByUserId(
        user.session?.user.id || ""
      );

      if (groups) {
        states.group.setState((prev) => ({
          ...prev,
          groups
        }));
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await services.auth.logout();
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <KeyboardAvoidingView className="bg-typography-0 flex-1" behavior="padding">
      <Box className="sticky top-0 bg-primary-400 px-4 pb-2 pt-20">
        <HStack className="gap-x-2 items-center">
          <VStack className="flex-1">
            <Text className="text-white opacity-80">Hello,</Text>
            <Text bold className="text-2xl text-white">
              {user.details?.first_name} {user.details?.last_name}
            </Text>
          </VStack>
          <Button variant="link" className="rounded-full">
            <Icon as="notifications" className="text-background-0" size={28} />
          </Button>
        </HStack>
      </Box>
      <ScrollView
        stickyHeaderIndices={[0]}
        className="flex-1"
        showsVerticalScrollIndicator={false}
      >
        <Box className="bg-primary-400 px-4 pb-4">
          <VStack className="gap-y-4">
            <HStack className="gap-x-4 items-center">
              <VStack className="gap-y-2 flex-1">
                <StatItem type="RECEIVE" amount={0} />
                <StatItem type="PAY" amount={0} />
              </VStack>
              <Box className="opacity-20 absolute right-[-20]">
                <Icon
                  as="wallet-giftcard"
                  size={150}
                  className="text-background-0"
                />
              </Box>
            </HStack>
            <HStack className="gap-x-2">
              <HeroButton
                icon="bolt"
                text="Quick Expense"
                onPress={() => router.push("/home/add-expense?quick=true")}
              />
              <HeroButton
                text="Create Group"
                icon="group-add"
                onPress={() => router.push("/groups/create")}
              />
            </HStack>
          </VStack>
        </Box>
        <VStack className="p-4 gap-y-4">
          <HStack className="items-center justify-between">
            <Text bold className="text-xl flex-1">
              Recent Activities
            </Text>
            <Link onPress={() => router.push("/activity")}>
              <Text className="text-primary-500">View All</Text>
            </Link>
          </HStack>
          <Card className="p-0 bg-typography-0 rounded-xl">
            {transaction.preview.map((item, index) => (
              <ActivityItem
                key={item.id}
                data={item}
                isLast={index === transaction.preview.length - 1}
              />
            ))}
          </Card>
        </VStack>

        <HStack className="items-center justify-between">
          <Text bold className="text-2xl flex-1">
            Active Groups
          </Text>
          <Link>
            <Text className="text-primary-400">View All</Text>
          </Link>
        </HStack>
        <FormButton text="Logout" onPress={handleLogout} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatItem({
  type,
  amount
}: {
  type: "RECEIVE" | "PAY";
  amount: number;
}) {
  return (
    <VStack className="py-4 flex-1">
      <HStack className="gap-x-4 items-center">
        <VStack className="gap-y-4 flex-1">
          <Text className="text-white">
            {type === "RECEIVE" ? "They Owe You" : "You Owe"}
          </Text>
          <Text bold className="text-5xl text-white">
            ₱{amount.toFixed(2)}
          </Text>
        </VStack>
      </HStack>
    </VStack>
  );
}

function ActivityItem({
  data,
  isLast
}: {
  data: TransactionPreview;
  isLast: boolean;
}) {
  return (
    <HStack className="px-4">
      <VStack
        className={`w-full py-6 ${isLast ? "" : "border-b border-typography-50"}`}
      >
        <HStack className="gap-2 items-center">
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
          <Badge
            size="lg"
            className="rounded-full"
            variant="solid"
            action={data.type === "expense" ? "error" : "success"}
          >
            <BadgeText>
              {data.type === "expense" ? `You owe` : `You are owed`} ₱
              {data.amount.toFixed(2)}
            </BadgeText>
          </Badge>
        </HStack>
      </VStack>
    </HStack>
  );
}

function HeroButton({
  text,
  icon,
  className,
  onPress
}: {
  text: string;
  icon: React.ComponentProps<typeof Icon>["as"];
  className?: string;
  onPress: () => void;
}) {
  const theme = useColorScheme();
  const bgColor = theme === "dark" ? "bg-primary-300" : "bg-primary-500";

  return (
    <Button
      className={`disabled:opacity-70 rounded-full flex-1 ${bgColor}`}
      size="lg"
      variant="solid"
      onPress={onPress}
    >
      <Box className="ml-[-8px]">
        <Icon as={icon} className="text-background-0" />
      </Box>
      <ButtonText className="text-white">{text}</ButtonText>
    </Button>
  );
}
