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
 * how old the rates are, and the rate feed's attribution link.
 *
 * Shared rather than inlined per surface for one specific reason — the link is a
 * licence condition of the free ExchangeRate-API endpoint, not decoration. A new
 * screen that starts converting money has to be unable to forget it, so the
 * caption and the attribution ship as one unit. It lives in components/ rather
 * than beside the book screens because CurrencyBreakdownSheet needs it too, and
 * a shared component can't reach into features/.
 *
 * Renders nothing when nothing was converted, so a single-currency book never
 * sees it.
 */
export default function ApproxRateNote({
  currencies,
  className = ""
}: {
  /** The currencies actually converted — drives which rate vintage is quoted. */
  currencies: string[];
  className?: string;
}) {
  const fx = useFxRates();

  if (currencies.length === 0) return null;

  return (
    <HStack className={`flex-wrap items-center gap-x-1 ${className}`}>
      <Text className="text-xs text-secondary-800">
        Approximate — rates as of {formatFxAsOf(fxAsOfFor(fx, currencies))}.
      </Text>
      <Pressable onPress={() => Linking.openURL(FX_ATTRIBUTION_URL)} hitSlop={8}>
        <Text className="text-xs text-secondary-800 underline">
          {FX_ATTRIBUTION_LABEL}
        </Text>
      </Pressable>
    </HStack>
  );
}
