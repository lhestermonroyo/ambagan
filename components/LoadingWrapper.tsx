import { ActivityIndicator } from "react-native";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

export default function LoadingWrapper({
  isLoading,
  text = "Loading...",
  skeleton,
  children
}: {
  isLoading: boolean;
  text?: string;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      skeleton ?? (
        <VStack className="p-8 items-center gap-y-2">
          <ActivityIndicator />
          <Text className="text-sm text-secondary-950">{text}</Text>
        </VStack>
      )
    );
  }

  return children;
}
