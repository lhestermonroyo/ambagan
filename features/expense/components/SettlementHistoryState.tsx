import FormButton from "@/components/FormButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

export default function SettlementHistoryState({ loading, error, onRetry }: {
  loading: boolean; error: string | null; onRetry: () => void;
}) {
  if (loading) return (
    <VStack className="gap-y-4" accessibilityLabel="Loading payment details" accessibilityState={{ busy: true }}>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </VStack>
  );
  if (!error) return null;
  return (
    <VStack className="rounded-xl bg-secondary-100 p-4 gap-y-3">
      <Text className="font-medium">Payment Details Unavailable</Text>
      <Text className="text-secondary-950">{error}</Text>
      <FormButton text="Try Again" variant="outline" onPress={onRetry} />
    </VStack>
  );
}
