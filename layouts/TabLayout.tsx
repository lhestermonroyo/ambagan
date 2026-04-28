import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { getSecondaryHex } from "@/utils/getColorHex";
import { Bell } from "lucide-react-native";

export default function TabLayout({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
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
              // onPress={() => setNotificationsOpen(true)}
            >
              <Bell size={24} color={getSecondaryHex("text-secondary-950")} />
            </Button>
          </HStack>
        </Box>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
