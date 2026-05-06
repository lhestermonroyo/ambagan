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
import AppearanceSheet from "@/features/profile/components/AppearanceSheet";
import NotificationsSheet from "@/features/profile/components/NotificationsSheet";
import TabLayout from "@/layouts/TabLayout";
import states from "@/states";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { useRouter } from "expo-router";
import {
  Bell,
  Eye,
  LogOut,
  UserCircle,
  UserLock,
  UsersRound
} from "lucide-react-native";
import { useMemo, useState } from "react";

export default function ProfileScreen() {
  const { details: userDetails, signOut, appearanceMode, notificationsEnabled } =
    states.user();
  const { reset: resetExpenseState } = states.expense();
  const { reset: resetGroupState } = states.group();
  const { reset: resetNotificationState } = states.notification();

  const router = useRouter();

  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const appearanceLabel =
    appearanceMode === "dark"
      ? "Dark"
      : appearanceMode === "system"
        ? "System"
        : "Light";

  const menuItems = useMemo(
    () => [
      {
        icon: <UserCircle color={getPrimaryHex("text-primary-400")} />,
        label: "Personal Info",
        description: "View and edit your personal information",
        onPress: () => router.push("/profile/personal-info")
      },
      {
        icon: <UsersRound color={getPrimaryHex("text-primary-400")} />,
        label: "Friends & Connections",
        description: "Manage your friends and social connections",
        onPress: () => {}
      },
      {
        icon: <UserLock color={getPrimaryHex("text-primary-400")} />,
        label: "Account & Privacy",
        description: "Manage your account settings and privacy preferences",
        onPress: () => router.push("/profile/account-settings")
      },
      {
        icon: <Eye color={getPrimaryHex("text-primary-400")} />,
        label: "App Appearance",
        description: "Customize the look and feel of the app",
        value: <Text className="text-lg">{appearanceLabel}</Text>,
        onPress: () => setAppearanceOpen(true)
      },
      {
        icon: <Bell color={getPrimaryHex("text-primary-400")} />,
        label: "Notifications",
        description: "Manage your notification preferences",
        value: (
          <Text className="text-lg">
            {notificationsEnabled ? "On" : "Off"}
          </Text>
        ),
        onPress: () => setNotificationsOpen(true)
      }
    ],
    [appearanceLabel, notificationsEnabled]
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

      <AppearanceSheet
        isOpen={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
      />

      <NotificationsSheet
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
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
    value?: React.ReactNode;
    onPress: () => void;
  };
}) {
  const { icon, label, description, value, onPress } = item;

  return (
    <PressableListItem onPress={onPress}>
      <HStack className="p-4 gap-x-4 items-center">
        {icon}
        <VStack className="flex-1">
          <Text className="text-lg flex-1">{label}</Text>
          <Text className="text-secondary-950">{description}</Text>
        </VStack>
        <HStack className="gap-x-2 items-center">
          {value}
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
