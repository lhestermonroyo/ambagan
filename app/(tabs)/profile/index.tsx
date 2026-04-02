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
import { formatDate } from "@/utils/formatDate";
import { Fragment } from "react";

type SettingsOption = {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Icon>["as"];
};

const settingsOptions: SettingsOption[] = [
  {
    title: "Currency",
    description: "Set preferred currency for expense tracking",
    icon: "price-change"
  },
  {
    title: "Favorites",
    description: "Manage favorite users for quick access",
    icon: "star"
  },
  {
    title: "Theme Mode",
    description: "Choose between light and dark mode for the app",
    icon: "display-settings"
  },
  {
    title: "Notifications",
    description: "Manage your notification settings",
    icon: "notifications"
  }
];

export default function ProfileScreen() {
  const user = states.user();
  const { details: userDetails } = user;

  return (
    <TabLayout title="Profile">
      <ScrollView className="flex-1" bounces={false}>
        <VStack className="gap-y-6">
          <AppAvatar
            className="self-center"
            uri={userDetails?.avatar || ""}
            name={userDetails?.first_name || ""}
            size="xl"
          />

          <VStack className="items-center gap-y-4">
            <VStack className="items-center">
              <Text bold className="text-xl">
                {userDetails?.first_name} {userDetails?.last_name}
              </Text>
              <HStack className="gap-x-1">
                <Text className="text-primary-400">{userDetails?.email}</Text>
                {userDetails?.phone && (
                  <Fragment>
                    <Text>•</Text>
                    <Text className="text-primary-400">
                      {userDetails.phone}
                    </Text>
                  </Fragment>
                )}
              </HStack>
            </VStack>

            <Text className="text-secondary-950">
              Active since {formatDate(userDetails?.created_at || "")}
            </Text>
          </VStack>

          <VStack className="items-center">
            <FormButton
              variant="outline"
              text="Edit Profile"
              icon={<Icon as="edit" className="text-primary-400" />}
              size="md"
            />
          </VStack>

          <VStack className="gap-y-4">
            <HStack className="px-4">
              <Text bold className="text-xl">
                Preferences
              </Text>
            </HStack>
            <FlatList
              scrollEnabled={false}
              data={settingsOptions}
              keyExtractor={(item) => item.title}
              renderItem={({ item }) => (
                <ListItem
                  title={item.title}
                  description={item.description}
                  icon={<Icon as={item.icon} className="text-primary-400" />}
                  onPress={() => {}}
                />
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
            />
          </VStack>
          <VStack className="px-4">
            <FormButton
              text="Logout"
              action="negative"
              icon={<Icon as="logout" className="text-background-0" />}
              onPress={() => {}}
            />
          </VStack>
        </VStack>
      </ScrollView>
    </TabLayout>
  );
}

const ListItem = ({
  title,
  description,
  icon,
  onPress
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  onPress: () => void;
}) => {
  return (
    <PressableListItem onPress={onPress}>
      <HStack className="p-4 gap-x-2 items-center">
        {icon && <Box>{icon}</Box>}
        <VStack className="flex-1">
          <Text className="text-lg">{title}</Text>
          {description && (
            <Text className="text-secondary-950 text-sm">{description}</Text>
          )}
        </VStack>
        <Icon as="chevron-right" className="text-secondary-950" />
      </HStack>
    </PressableListItem>
  );
};
