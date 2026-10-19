import FormButton from "@/components/FormButton";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { useBanner } from "@/hooks/useBanner";
import {
  setEmptyStatePreview,
  useEmptyStatePreview
} from "@/hooks/useEmptyStatePreview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function EmptyStatePreviewBanner() {
  const enabled = useEmptyStatePreview();
  const { visible: hasNetworkBanner } = useBanner();
  const insets = useSafeAreaInsets();

  if (!enabled) return null;

  return (
    <HStack
      className="bg-secondary-100 px-4 pb-2 items-center gap-x-3"
      style={{ paddingTop: hasNetworkBanner ? 8 : insets.top + 8 }}
    >
      <Text className="flex-1 text-sm text-secondary-950">
        Empty state preview · data unchanged
      </Text>
      <FormButton
        size="sm"
        text="Turn Off"
        onPress={() => setEmptyStatePreview(false)}
      />
    </HStack>
  );
}
