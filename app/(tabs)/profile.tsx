import AppAvatar from "@/components/AppAvatar";
import { CurrencySelectionSheet } from "@/components/CurrencySelection";
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
import NotificationsSheet from "@/features/profile/components/PushNotificationsSheet";
import TabLayout from "@/layouts/TabLayout";
import states from "@/states";
import { currencies } from "@/utils/constants";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { useRouter } from "expo-router";
import {
  Bell,
  CircleQuestionMark,
  Coins,
  Eye,
  Info,
  LogOut,
  MonitorCog,
  Moon,
  Sun,
  UserCircle,
  UserLock
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export default function ProfileScreen() {
  const {
    details: userDetails,
    signOut,
    appearanceMode,
    preferences,
    notificationsEnabled,
    defaultCurrency,
    setDefaultCurrency
  } = states.user();
  const { reset: resetExpenseState } = states.expense();
  const { reset: resetGroupState } = states.group();
  const { reset: resetNotificationState } = states.notification();

  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const currencyLabel = useMemo(() => {
    return currencies.find((c) => c.value === defaultCurrency)?.label;
  }, [defaultCurrency]);

  const appearanceLabel = useMemo(() => {
    switch (appearanceMode) {
      case "light":
        return <Sun color={getPrimaryHex("text-primary-400", colorScheme)} />;
      case "dark":
        return <Moon color={getPrimaryHex("text-primary-400", colorScheme)} />;
      case "system":
        return (
          <MonitorCog color={getPrimaryHex("text-primary-400", colorScheme)} />
        );
      default:
        return "Light";
    }
  }, [appearanceMode]);

  const menuItems = useMemo(
    () => [
      {
        icon: (
          <UserCircle color={getPrimaryHex("text-primary-400", colorScheme)} />
        ),
        label: "Personal Info",
        description: "View and edit your personal information",
        onPress: () => router.push("/profile/personal-info")
      },
      {
        icon: (
          <UserLock color={getPrimaryHex("text-primary-400", colorScheme)} />
        ),
        label: "Account Settings",
        description: "Manage your account security and preferences",
        onPress: () => router.push("/profile/account-settings")
      },
      {
        icon: <Bell color={getPrimaryHex("text-primary-400", colorScheme)} />,
        label: "Push Notifications",
        description: "Manage your push notification preferences",
        onPress: () => setNotificationsOpen(true)
      },
      {
        icon: <Coins color={getPrimaryHex("text-primary-400", colorScheme)} />,
        label: "Default Currency",
        description: "Manage your default currency",
        value: <Text className="text-lg">{currencyLabel}</Text>,
        onPress: () => setCurrencyOpen(true)
      },
      {
        icon: <Eye color={getPrimaryHex("text-primary-400", colorScheme)} />,
        label: "App Appearance",
        description: "Customize the look and feel of the app",
        value: <Text className="text-lg">{appearanceLabel}</Text>,
        onPress: () => setAppearanceOpen(true)
      },
      {
        icon: (
          <CircleQuestionMark
            color={getPrimaryHex("text-primary-400", colorScheme)}
          />
        ),
        label: "Help Center",
        description: "Get support and find answers to your questions",
        onPress: () => router.push("/profile/help-center")
      },
      // {
      //   icon: <Info color={getPrimaryHex("text-primary-400", colorScheme)} />,
      //   label: "About",
      //   description: "Learn more about the app and its features",
      //   onPress: () => router.push("/profile/about")
      // }
    ],
    [
      appearanceLabel,
      notificationsEnabled,
      preferences,
      currencyLabel,
      colorScheme
    ]
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
        <VStack className="gap-y-8">
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
                <LogOut
                  size={18}
                  color={getSecondaryHex("text-secondary-0", colorScheme)}
                />
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

      <CurrencySelectionSheet
        isOpen={currencyOpen}
        currency={defaultCurrency}
        title="Select Default Currency"
        onClose={() => setCurrencyOpen(false)}
        onCurrencyChange={(currency) => {
          if (userDetails?.id) setDefaultCurrency(userDetails.id, currency);
        }}
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
      <HStack className="p-4 gap-x-2 items-start justify-start">
        {icon}
        <VStack className="flex-1">
          <Text className="text-lg flex-1">{label}</Text>
          <Text className="text-secondary-950">{description}</Text>
        </VStack>
        <HStack className="gap-x-2 items-center self-center">
          {value}
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
