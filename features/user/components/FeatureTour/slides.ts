import {
  ART_BILL_DIVIDED,
  ART_DIVERSIFIED_BASKET,
  ART_SCAN_TEXT,
  ART_SHARED_EXPENSE_LIST,
  type TourArt
} from "./art";

export type TourSlide = {
  key: string;
  art: TourArt;
  title: string;
  body: string;
};

/**
 * Four slides, in the order someone actually meets the app: log something,
 * see where you stand, then the two things nothing in the UI announces — Books
 * and receipt scanning.
 *
 * Deliberately no Pro pitch. The paywall already sits at the points where
 * someone hits a limit, and leading a welcome with one sours it.
 */
export const TOUR_SLIDES: TourSlide[] = [
  {
    key: "split",
    art: ART_BILL_DIVIDED,
    title: "Split the bill",
    body: "Add what was spent and who was in on it. Ambagan does the dividing: evenly, by exact amounts, or by percentage."
  },
  {
    key: "settle",
    art: ART_SHARED_EXPENSE_LIST,
    title: "See exactly who owes who",
    body: "It all adds up to one net balance per person, so nobody has to do the math. Settle up and attach a screenshot as proof."
  },
  {
    key: "books",
    art: ART_DIVERSIFIED_BASKET,
    title: "Track your own spending too",
    body: "Books are for the expenses that are just yours. Give one a budget and watch how the month goes."
  },
  {
    key: "scan",
    art: ART_SCAN_TEXT,
    title: "Skip the typing",
    body: "Point your camera at a receipt and Ambagan fills in the amount, merchant, and date. Check it, then save."
  }
];
