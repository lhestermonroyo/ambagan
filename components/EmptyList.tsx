import { EmptyType } from "@/types/general";
import { emptyTypes } from "@/utils/constants";
import { useColorScheme } from "nativewind";
import { Image } from "react-native";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

const IMAGES = {
  book: {
    light: require("@/assets/images/book-light.png"),
    dark: require("@/assets/images/book-dark.png")
  },
  expense: {
    light: require("@/assets/images/expense-light.png"),
    dark: require("@/assets/images/expense-dark.png")
  },
  favorite: {
    light: require("@/assets/images/favorite-light.png"),
    dark: require("@/assets/images/favorite-dark.png")
  },
  friends: {
    light: require("@/assets/images/friends-light.png"),
    dark: require("@/assets/images/friends-dark.png")
  },
  groups: {
    light: require("@/assets/images/groups-light.png"),
    dark: require("@/assets/images/groups-dark.png")
  },
  notification: {
    light: require("@/assets/images/notification-light.png"),
    dark: require("@/assets/images/notification-dark.png")
  },
  search: {
    light: require("@/assets/images/search-light.png"),
    dark: require("@/assets/images/search-dark.png")
  },
  settlement: {
    light: require("@/assets/images/settlement-light.png"),
    dark: require("@/assets/images/settlement-dark.png")
  },
  // Catch-all. Also stands in for the types that have no dedicated art yet —
  // see the placeholder block below.
  general: {
    light: require("@/assets/images/general-light.png"),
    dark: require("@/assets/images/general-dark.png")
  }
} as const;

type ImageKey = keyof typeof IMAGES;

const TYPE_TO_IMAGE: Record<EmptyType, ImageKey> = {
  [EmptyType.EXPENSE]: "expense",
  [EmptyType.BOOK]: "book",
  [EmptyType.NOTIFICATION]: "notification",
  [EmptyType.FAVORITE]: "favorite",
  [EmptyType.GROUP]: "groups",

  // Every settlement flavour shares the receipt — the copy carries the
  // distinction between pending/requested/settled, the illustration doesn't.
  [EmptyType.SETTLEMENT]: "settlement",
  [EmptyType.SETTLEMENT_ALL]: "settlement",
  [EmptyType.SETTLEMENT_PENDING]: "settlement",
  [EmptyType.SETTLEMENT_REQUESTED]: "settlement",
  [EmptyType.SETTLEMENT_SETTLED]: "settlement",
  [EmptyType.OUTSTANDING]: "settlement",
  [EmptyType.HISTORY]: "settlement",

  // People, in all three flavours the app names them — friends, group members,
  // and searchable users. `favorite` stays separate: its heart badge means the
  // favourites list specifically, not people in general.
  [EmptyType.FRIEND]: "friends",
  [EmptyType.MEMBER]: "friends",
  [EmptyType.USER]: "friends",

  [EmptyType.SEARCH]: "search",

  // The catch-all. Nothing is a placeholder any more — every type above has
  // art that fits it, and `general` is only for the genuinely generic case.
  [EmptyType.ACTIVITY]: "general"
};

/**
 * Box the illustration is laid out in. `contain` fits the whole FILE, transparent
 * padding included, so a single box size does NOT render every glyph at the same
 * scale — it renders every *file* at the same scale. Most of the set is square
 * with ~16% padding baked in and lands its glyph at ~67px tall here.
 */
const DEFAULT_BOX = { width: 80, height: 80 };

/**
 * Per-asset boxes for art whose padding differs from the rest, sized so the
 * visible glyph still lands at ~67px tall. Keep this as small as possible: an
 * entry here is compensating for an export inconsistency, so the better fix is
 * always to re-export the asset to match the set and delete its override.
 */
const BOX: Partial<Record<ImageKey, typeof DEFAULT_BOX>> = {
  // 470x427 and drawn edge-to-edge — zero padding, unlike everything else. In
  // the default box it renders 80x73 against the set's ~67x67, reading about a
  // fifth larger and sitting tighter to the copy. 74x67 is its own aspect ratio
  // scaled to a 67px-tall glyph, so it matches without being letterboxed.
  friends: { width: 74, height: 67 }
};

const EmptyList = ({
  type,
  content
}: {
  type: EmptyType;
  // Optional copy override — falls back to the default text for `type`.
  content?: string;
}) => {
  // nativewind's, not react-native's: App Appearance (Light/Dark/System) is
  // applied by GluestackUIProvider via nativewind's setColorScheme, so the
  // react-native hook reports the OS scheme and ignores the in-app choice.
  const { colorScheme } = useColorScheme();
  const empty = emptyTypes.find((item) => item.type === type);
  const imageKey = TYPE_TO_IMAGE[type];
  const source = IMAGES[imageKey][colorScheme === "dark" ? "dark" : "light"];

  return (
    // The box is centred in a fixed-height slot so a shorter override can't
    // shift the copy up relative to the other empty states.
    <VStack className="w-full justify-center items-center gap-y-3 py-6">
      <VStack
        className="justify-center items-center"
        style={{ height: DEFAULT_BOX.height }}
      >
        <Image
          source={source}
          style={BOX[imageKey] ?? DEFAULT_BOX}
          resizeMode="contain"
        />
      </VStack>
      <Text className="text-center text-secondary-950 px-4">
        {content ?? empty?.content}
      </Text>
    </VStack>
  );
};

export default EmptyList;
