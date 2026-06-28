import { EmptyType } from "@/types/general";
import { emptyTypes } from "@/utils/constants";
import { Image, useColorScheme } from "react-native";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

const IMAGES = {
  expense: {
    light: require("@/assets/images/light-empty-expense.png"),
    dark: require("@/assets/images/dark-empty-expense.png")
  },
  notification: {
    light: require("@/assets/images/light-empty-notification.png"),
    dark: require("@/assets/images/dark-empty-notification.png")
  },
  search: {
    light: require("@/assets/images/light-empty-search.png"),
    dark: require("@/assets/images/dark-empty-search.png")
  },
  user: {
    light: require("@/assets/images/light-empty-user.png"),
    dark: require("@/assets/images/dark-empty-user.png")
  },
  inbox: {
    light: require("@/assets/images/light-empty-inbox.png"),
    dark: require("@/assets/images/dark-empty-inbox.png")
  },
  list: {
    light: require("@/assets/images/light-empty-list.png"),
    dark: require("@/assets/images/dark-empty-list.png")
  }
} as const;

type ImageKey = keyof typeof IMAGES;

const TYPE_TO_IMAGE: Record<EmptyType, ImageKey> = {
  [EmptyType.EXPENSE]: "expense",
  [EmptyType.NOTIFICATION]: "notification",
  [EmptyType.SEARCH]: "search",
  [EmptyType.FRIEND]: "expense",
  [EmptyType.USER]: "user",
  [EmptyType.FAVORITE]: "user",
  [EmptyType.MEMBER]: "user",
  [EmptyType.GROUP]: "user",
  [EmptyType.ACTIVITY]: "list",
  [EmptyType.SETTLEMENT]: "expense",
  [EmptyType.SETTLEMENT_ALL]: "expense",
  [EmptyType.SETTLEMENT_PENDING]: "expense",
  [EmptyType.SETTLEMENT_REQUESTED]: "expense",
  [EmptyType.SETTLEMENT_SETTLED]: "expense",
  [EmptyType.OUTSTANDING]: "expense",
  [EmptyType.HISTORY]: "expense"
};

const EmptyList = ({ type }: { type: EmptyType }) => {
  const colorScheme = useColorScheme() ?? "light";
  const empty = emptyTypes.find((item) => item.type === type);
  const imageKey = TYPE_TO_IMAGE[type];
  const source = IMAGES[imageKey][colorScheme === "dark" ? "dark" : "light"];

  return (
    <VStack className="w-full justify-center items-center gap-y-3 py-6">
      <Image
        source={source}
        style={{ width: 80, height: 80 }}
        resizeMode="contain"
      />
      <Text className="text-center text-secondary-950">{empty?.content}</Text>
    </VStack>
  );
};

export default EmptyList;
