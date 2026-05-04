import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import TabLayout from "@/layouts/TabLayout";
import states from "@/states";
import { getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useRouter } from "expo-router";
import {
  Bell,
  Eye,
  LogOut,
  UserCircle,
  UserLock,
  UsersRound
} from "lucide-react-native";
import { useMemo } from "react";

export default function ProfileScreen() {
  const { details: userDetails, signOut } = states.user();
  const { reset: resetExpenseState } = states.expense();
  const { reset: resetGroupState } = states.group();
  const { reset: resetNotificationState } = states.notification();

  const router = useRouter();

  const menuItems = useMemo(
    () => [
      {
        icon: <UserCircle color={getSecondaryHex("text-secondary-950")} />,
        label: "Personal Info",
        description: "View and edit your personal information",
        onPress: () => {}
      },
      {
        icon: <UsersRound color={getSecondaryHex("text-secondary-950")} />,
        label: "Friends & Connections",
        description: "Manage your friends and social connections",
        onPress: () => {}
      },
      {
        icon: <UserLock color={getSecondaryHex("text-secondary-950")} />,
        label: "Account & Privacy",
        description: "Manage your account settings and privacy preferences",
        onPress: () => {}
      },
      {
        icon: <Eye color={getSecondaryHex("text-secondary-950")} />,
        label: "App Appearance",
        description: "Customize the look and feel of the app",
        onPress: () => {}
      },
      {
        icon: <Bell color={getSecondaryHex("text-secondary-950")} />,
        label: "Notifications",
        description: "Manage your notification preferences",
        onPress: () => {}
      }
    ],
    []
  );

  const handleSignOut = () => {
    signOut();

    resetExpenseState();
    resetGroupState();
    resetNotificationState();

    router.replace("/login");
  };

  return (
    <TabLayout title="Profile">
      <ScrollView className="flex-1" bounces={false}>
        <VStack className="pb-4 gap-y-6">
          <HStack className="px-4 gap-x-4 items-center">
            <VStack>
              <AppAvatar
                className="self-center"
                uri={userDetails?.avatar || ""}
                name={userDetails?.first_name || "User Avatar"}
                size="lg"
              />
            </VStack>
            <VStack>
              <Text bold className="text-2xl" numberOfLines={3}>
                {userDetails?.first_name} {userDetails?.last_name}
              </Text>
              <Text className="text-secondary-950">{userDetails?.email}</Text>
            </VStack>
          </HStack>

          <FlatList
            data={menuItems}
            keyExtractor={(item) => item.label}
            scrollEnabled={false}
            renderItem={({ item }) => <MenuItem item={item} />}
            ItemSeparatorComponent={() => (
              <Box className="mx-4">
                <Divider className="border-secondary-100" />
              </Box>
            )}
          />

          <VStack className="px-4">
            <FormButton
              text="Sign Out"
              action="negative"
              onPress={handleSignOut}
              icon={
                <LogOut size={18} color={getSecondaryHex("text-secondary-0")} />
              }
            />
          </VStack>
        </VStack>
      </ScrollView>
    </TabLayout>
  );
}

function MenuItem({
  item
}: {
  item: {
    icon: React.ReactNode;
    label: string;
    description: string;
    onPress: () => void;
  };
}) {
  const { icon, label, description, onPress } = item;

  return (
    <PressableListItem onPress={onPress}>
      <HStack className="p-4 gap-x-4 items-center">
        {icon}
        <VStack className="flex-1">
          <Text
            className={cn(
              "text-lg flex-1",
              label === "Sign Out" ? "text-error-400" : undefined
            )}
          >
            {label}
          </Text>

          <Text className="text-secondary-950">{description}</Text>
        </VStack>
        <Icon as="chevron-right" className="text-secondary-950" />
      </HStack>
    </PressableListItem>
  );
}
