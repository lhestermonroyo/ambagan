import AppAvatar from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Book } from "@/types/books";
import { formatDate } from "@/utils/formatDate";

export default function BookItem({
  details,
  onOpen
}: {
  details: Book;
  onOpen: () => void;
}) {
  const count = details.expense_count ?? 0;

  return (
    <PressableListItem className="p-4" onPress={onOpen}>
      <HStack className="items-center gap-x-3">
        <AppAvatar name={details.name} uri={details.avatar || undefined} />
        <VStack className="flex-1">
          <Text
            className="text-lg flex-shrink"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {details.name}
          </Text>
          <HStack className="gap-x-1 items-center">
            {details.pending && (
              <Icon as="sync" size={14} className="text-primary-400" />
            )}
            <Text className="text-sm text-secondary-950">
              {formatDate(details.created_at)} • {count} expense
              {count !== 1 ? "s" : ""}
            </Text>
          </HStack>
        </VStack>
        <Icon as="chevron-right" className="text-secondary-950" />
      </HStack>
    </PressableListItem>
  );
}
