import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { WifiOff } from "lucide-react-native";

export default function OfflineBanner() {
  return (
    <HStack className="bg-error-500 px-4 py-2 items-center justify-center gap-x-2">
      <WifiOff size={14} color="white" />
      <Text className="text-background-0 font-medium">
        You're offline. Showing cached data.
      </Text>
    </HStack>
  );
}
