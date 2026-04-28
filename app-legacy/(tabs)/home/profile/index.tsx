import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { formatDate } from "@/utils/formatDate";
import { router } from "expo-router";

type SettingsOption = {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Icon>["as"];
};

const settingsOptions: SettingsOption[] = [
  {
    title: "Appearance",
    description: "Customize the look and feel of the app",
    icon: "display-settings"
  },
  {
    title: "Notifications",
    description: "Receive updates about your groups and expenses",
    icon: "notifications"
  }
];

export default function ProfileScreen() {
  const user = states.user();
  const { details: userDetails } = user;

  const handleLogout = async () => {
    try {
      await services.auth.logout();

      states.user.getState().reset();
      states.group.getState().reset();
      states.expense.getState().reset();

      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <InnerLayout
      onBack={() => router.back()}
      title="Profile"
      actions={[
        <Button variant="link" className="rounded-full" onPress={() => {}}>
          <Icon as="edit" size={28} className="text-secondary-950" />
        </Button>
      ]}
    >
      <ScrollView className="flex-1" bounces={false}>
        <VStack className="items-center gap-y-4">
          <AppAvatar
            className="self-center"
            uri={userDetails?.avatar || ""}
            name={userDetails?.first_name || ""}
            size="lg"
          />
          <VStack className="items-center">
            <Text bold className="text-xl">
              {userDetails?.first_name} {userDetails?.last_name}
            </Text>
            <HStack className="gap-x-1">
              <Text className="text-secondary-950">{userDetails?.email}</Text>
            </HStack>
          </VStack>

          <VStack className="w-full p-4 gap-y-2">
            <Text className="text-secondary-950 font-semibold uppercase">
              Profile Details
            </Text>
            <Card className="w-full border border-secondary-200 p-0 rounded-xl overflow-hidden">
              <DetailItem
                label="Member Since"
                value={formatDate(userDetails?.created_at || "")}
              />
              <DetailItem label="Phone" value={userDetails?.phone || "-"} />
            </Card>
          </VStack>
        </VStack>

        <VStack className="gap-y-12">
          <VStack className="gap-y-2">
            <VStack className="px-4">
              <Text className="text-secondary-950 font-semibold uppercase">
                Preferences
              </Text>
            </VStack>
            <FlatList
              scrollEnabled={false}
              data={settingsOptions}
              keyExtractor={(item) => item.title}
              renderItem={({ item }) => (
                <ListItem
                  title={item.title}
                  description={item.description}
                  icon={<Icon as={item.icon} />}
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
              onPress={handleLogout}
            />
          </VStack>
        </VStack>
      </ScrollView>
    </InnerLayout>
  );
}

const DetailItem = ({
  label,
  value
}: {
  label: string;
  value: string | number | undefined;
}) => {
  return (
    <PressableListItem onPress={() => {}}>
      <HStack className="justify-between items-center p-4">
        <Text className="text-secondary-950 flex-1">{label}</Text>
        <Text className="flex-1 text-left">{value || "-"}</Text>
      </HStack>
    </PressableListItem>
  );
};

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
