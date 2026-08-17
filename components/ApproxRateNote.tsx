import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  FX_ATTRIBUTION_LABEL,
  FX_ATTRIBUTION_URL,
  formatFxAsOf,
  fxAsOfFor,
  useFxRates
} from "@/utils/fx";
import { Linking } from "react-native";

/**
 * The caption that MUST accompany any converted figure: how approximate it is,
 * how old the rates are, and the rate feed's attribution link. The link is a
 * licence condition of the free ExchangeRate-API endpoint, not decoration —
 * caption and attribution ship as one unit so a screen that starts converting
 * money can't forget half of it.
 *
 * It belongs in the CURRENCY BREAKDOWN SHEET, not on the card. Stat cards carry
 * an "≈" and nothing else: a note under every converted figure buried the
 * figures themselves, and the sheet is where someone who wants to know how a
 * number was arrived at is already going. That places one obligation on the
 * chip that opens the sheet — it has to stay visible whenever a conversion
 * happened, even on a single foreign currency, or the disclosure has no route
 * to the screen (see CurrencyCountButton).
 *
 * The Stats tabs keep a tab-level note as well, even though their chip does open
 * a converting sheet: most of what they convert has no chip of its own — the
 * group's You view, the member breakdown, the averages — so the sheet's own copy
 * of this caption only covers the one card it hangs off.
 *
 * Renders nothing when nothing was converted, so a single-currency book never
 * sees it.
 */
export default function ApproxRateNote({
  currencies,
  className = "",
  tone = "default"
}: {
  /** The currencies actually converted — drives which rate vintage is quoted. */
  currencies: string[];
  className?: string;
  /** "onColor" for a caption sitting on the primary fill, where the muted
   *  secondary grey has too little contrast to be legible. */
  tone?: "default" | "onColor";
}) {
  const fx = useFxRates();

  if (currencies.length === 0) return null;

  const textColor = tone === "onColor" ? "text-white/70" : "text-secondary-800";

  return (
    <HStack className={`flex-wrap items-center gap-x-1 ${className}`}>
      <Text className={`text-xs ${textColor}`}>
        Approximate — rates as of {formatFxAsOf(fxAsOfFor(fx, currencies))}.
      </Text>
      <Pressable
        onPress={() => Linking.openURL(FX_ATTRIBUTION_URL)}
        hitSlop={8}
      >
        <Text className={`text-xs ${textColor} underline`}>
          {FX_ATTRIBUTION_LABEL}
        </Text>
      </Pressable>
    </HStack>
  );
}
