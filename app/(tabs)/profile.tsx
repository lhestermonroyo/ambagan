import AppAvatar from "@/components/AppAvatar";
import { CurrencySelectionSheet } from "@/components/CurrencySelection";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import PressableListItem from "@/components/PressableListItem";
import ProBadge from "@/components/ProBadge";
import { Box } from "@/components/ui/box";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import AppearanceSheet from "@/features/profile/components/AppearanceSheet";
import NotificationsSheet from "@/features/profile/components/PushNotificationsSheet";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { currencies } from "@/utils/constants";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
  Bell,
  CircleQuestionMark,
  Coins,
  Crown,
  Eye,
  LogOut,
  MonitorCog,
  Moon,
  Sun,
  UserCircle,
  UserLock
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, useColorScheme } from "react-native";

export default function ProfileScreen() {
  const {
    details: userDetails,
    signOut,
    appearanceMode,
    defaultCurrency,
    setDefaultCurrency
  } = states.user();

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

  const isPro = userDetails?.plan === "pro";

  const handleNotificationsOpen = useCallback(
    () => setNotificationsOpen(true),
    []
  );

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
        onPress: handleNotificationsOpen
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
      }
      // {
      //   icon: <Info color={getPrimaryHex("text-primary-400", colorScheme)} />,
      //   label: "About",
      //   description: "Learn more about the app and its features",
      //   onPress: () => router.push("/profile/about")
      // }
    ],
    [appearanceLabel, currencyLabel, colorScheme, handleNotificationsOpen]
  );

  const handleSignOut = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") {
        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId
        });
        await services.pushToken.removePushToken(token);
      }
    } catch {
      // silently ignore — don't block sign out if token removal fails
    }

    signOut();
    router.replace("/(auth)/welcome");
  };

  return (
    <TabLayout title="Profile">
      <ScrollView className="flex-1">
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
            <VStack className="flex-1">
              <HStack className="items-center gap-x-2">
                <Text bold className="text-2xl flex-shrink" numberOfLines={2}>
                  {userDetails?.first_name} {userDetails?.last_name}
                </Text>
                {isPro && <ProBadge />}
              </HStack>
              <Text className="text-secondary-950">{userDetails?.email}</Text>
            </VStack>
          </HStack>

          <VStack className="gap-y-4">
            <Pressable
              className="mx-4"
              onPress={() => router.push("/profile/subscription")}
            >
              <Box
                className={cn(
                  "rounded-2xl p-4 flex-row items-center gap-x-2",
                  isPro ? "bg-primary-400" : "bg-warning-400"
                )}
              >
                <Box className="bg-background-0 rounded-full p-4">
                  <Crown
                    size={24}
                    color={
                      isPro
                        ? getPrimaryHex("text-primary-400", colorScheme)
                        : "#d97706"
                    }
                  />
                </Box>
                <VStack className="flex-1">
                  <Text bold className="text-background-0 text-xl">
                    {isPro ? "You're on Pro!" : "Upgrade to Pro!"}
                  </Text>
                  <Text className="text-background-0 opacity-80">
                    {isPro
                      ? "Manage your active subscription"
                      : "Unlock multi-currency, exports & more"}
                  </Text>
                </VStack>
                <Icon as="chevron-right" className="text-background-0" />
              </Box>
            </Pressable>

            <FlatList
              data={menuItems}
              keyExtractor={(item) => item.label}
              scrollEnabled={false}
              renderItem={({ item }) => <MenuItem item={item} />}
              ItemSeparatorComponent={ListDivider}
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
        </VStack>
        <Box className="h-16" />
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
