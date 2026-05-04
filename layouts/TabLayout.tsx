import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import NotificationSheet from "@/features/notifications/components/NotificationSheet";
import states from "@/states";
import { getSecondaryHex } from "@/utils/getColorHex";
import { Bell } from "lucide-react-native";
import { Fragment, useState } from "react";

export default function TabLayout({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { unreadCount } = states.notification.getState();

  return (
    <Fragment>
      <SafeAreaView className="flex-1 bg-background-0">
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <Box className="p-4">
            <HStack className="items-center">
              <Text bold className="flex-1 text-3xl">
                {title}
              </Text>
              <Button
                variant="link"
                className="rounded-full"
                onPress={() => setNotificationsOpen(true)}
              >
                <Box className="relative">
                  <Bell
                    size={24}
                    color={getSecondaryHex("text-secondary-950")}
                  />
                  {unreadCount > 0 && (
                    <Box className="absolute -top-1 -right-1 bg-error-400 rounded-full w-4 h-4 items-center justify-center">
                      <Text className="text-background-0 text-xs font-bold leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Text>
                    </Box>
                  )}
                </Box>
              </Button>
            </HStack>
          </Box>
          {children}
        </KeyboardAvoidingView>
      </SafeAreaView>
      <NotificationSheet
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </Fragment>
  );
}
