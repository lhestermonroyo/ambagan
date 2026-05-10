import FormButton from "@/components/FormButton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

export default function ListFooter({
  hasNextPage,
  loading,
  onLoadMore,
  showEndMessage = false
}: {
  hasNextPage: boolean;
  loading: boolean;
  onLoadMore: () => void;
  showEndMessage?: boolean;
}) {
  if (hasNextPage) {
    return (
      <FormButton
        size="md"
        variant="outline"
        className="mx-4 my-2"
        text="Load More"
        loading={loading}
        onPress={onLoadMore}
      />
    );
  }
  if (showEndMessage) {
    return (
      <VStack className="justify-center items-center p-4">
        <Text className="text-secondary-950 text-center">
          You've reached the end.
        </Text>
      </VStack>
    );
  }
  return null;
}
