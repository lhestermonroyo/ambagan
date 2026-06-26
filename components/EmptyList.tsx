import { EmptyType } from "@/types/general";
import { emptyTypes } from "@/utils/constants";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

const EmptyList = ({ type }: { type: EmptyType }) => {
  const empty = emptyTypes.find((item) => item.type === type);

  return (
    <VStack className="w-full justify-center items-center gap-y-2 h-32">
      <Text className="text-3xl">{empty?.icon}</Text>
      <Text className="text-center text-sm text-secondary-950">{empty?.content}</Text>
    </VStack>
  );
};

export default EmptyList;
