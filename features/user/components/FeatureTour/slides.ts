import type { ImageSourcePropType } from "react-native";

export type TourSlide = {
  key: string;
  art: ImageSourcePropType;
  title: string;
  body: string;
};

/**
 * Four slides, in the order someone actually meets the app: log something,
 * see where you stand, then discover Individual mode and receipt scanning.
 *
 * Deliberately no Pro pitch. The paywall already sits at the points where
 * someone hits a limit, and leading a welcome with one sours it.
 */
export const TOUR_SLIDES: TourSlide[] = [
  {
    key: "split",
    art: require("@/assets/illustrations/feature-tour/split-bill.png"),
    title: "Split the bill",
    body: "Add what was spent and who was in on it. Ambagan does the dividing: evenly, by exact amounts, or by percentage."
  },
  {
    key: "settle",
    art: require("@/assets/illustrations/feature-tour/settle-balances.png"),
    title: "See exactly who owes who",
    body: "It all adds up to one net balance per person, so nobody has to do the math. Settle up and attach a screenshot as proof."
  },
  {
    key: "books",
    art: require("@/assets/illustrations/feature-tour/personal-spending.png"),
    title: "Track your own spending too",
    body: "Choose Individual mode when creating an entry in Groups to track expenses that are just yours. Record your expenses and see how much you have spent."
  },
  {
    key: "scan",
    art: require("@/assets/illustrations/feature-tour/scan-receipt.png"),
    title: "Skip the typing",
    body: "Point your camera at a receipt and Ambagan fills in the amount, merchant, and date. Check it, then save."
  }
];
