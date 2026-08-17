import AppSheet from "@/components/AppSheet";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import BookItem from "@/features/book/components/BookItem";
import { Book } from "@/types/books";

/**
 * "Add to which book?" picker — shown from the Overview quick-add when the user
 * has 2+ books (0 → create, 1 → straight to the form, so this only handles the
 * many case). Tapping a row hands the chosen book back to the caller.
 */
export default function BookPickerSheet({
  isOpen,
  onClose,
  books,
  onSelect,
  title = "Add to which book?"
}: {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  onSelect: (book: Book) => void;
  title?: string;
}) {
  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="w-full flex-1 gap-y-4"
    >
      <Pressable onPress={onClose}>
        <HStack className="p-4 items-center">
          <Icon as="arrow-back-ios" className="text-secondary-950" />
          <Text bold className="text-xl">
            {title}
          </Text>
        </HStack>
      </Pressable>
      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <BookItem details={item} onOpen={() => onSelect(item)} />
        )}
        ItemSeparatorComponent={ListDivider}
      />
    </AppSheet>
  );
}
