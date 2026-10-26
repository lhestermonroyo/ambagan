import GroupItem from "@/features/group/components/GroupItem";
import { individualGroupEntry } from "@/features/group/utils/groupMode";
import states from "@/states";
import type { Book } from "@/types/books";

export default function BookItem({ details, onOpen }: { details: Book; onOpen: () => void }) {
  const { details: owner } = states.user();
  if (!owner || owner.id !== details.user_id) return null;
  return <GroupItem details={individualGroupEntry(details, owner)} onOpen={onOpen} />;
}
