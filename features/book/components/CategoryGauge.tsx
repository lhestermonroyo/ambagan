import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { getSecondaryHex } from "@/utils/getColorHex";
import { useMemo } from "react";
import { useColorScheme } from "react-native";
import Svg, { Line } from "react-native-svg";

export type GaugeSlice = {
  key: string;
  label: string;
  color: string;
  amount: number;
  pct: number;
};

/** Tick count across the whole arc. High enough that a ~2% slice still reads
 *  as more than a rounding artifact, low enough to stay legible on a phone. */
const TICKS = 44;

// Drawn in a fixed viewBox and scaled by the SVG's own aspect ratio, so the
// geometry never has to care about the real pixel width.
const VB_WIDTH = 280;
const CENTER_X = VB_WIDTH / 2;
const CENTER_Y = 132;
const R_OUTER = 128;
const R_INNER = 94;
const VB_HEIGHT = CENTER_Y + 6;

/**
 * Where the money went, as a semi-circle meter: one tick per ~2% of spend, colored
 * by category, with the total in the middle and a labelled legend underneath.
 *
 * This is the home for the category story — it used to be crammed into the
 * budget card's 2px progress bar, where six categories produced six unlabelled
 * slivers and a legend that wrapped onto three lines. A meter that owns its own
 * card can show the same split at a size where each slice is actually readable,
 * and the legend can afford to carry both the share and the amount.
 *
 * Ticks rather than a smooth arc on purpose: a continuous ring renders a 2%
 * category as a hairline that reads as a border artifact, while the smallest
 * slice here is always at least one full tick.
 *
 * Measures spend against ITSELF, not against a budget — the Stats tab is date-
 * ranged, so the arc is always full and the widths are pure proportion. A
 * partly-grey arc would imply a cap that the selected range may not share.
 */
export default function CategoryGauge({
  slices,
  total,
  currency,
  label = "Total spent",
  approx = false
}: {
  /** Largest first. Slices with a zero amount are ignored. */
  slices: GaugeSlice[];
  total: number;
  currency: string;
  label?: string;
  /** Marks the centre figure and legend amounts as converted. */
  approx?: boolean;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const emptyColor = getSecondaryHex("text-secondary-200", colorScheme);

  // One color per tick, largest-remainder allocated so every non-zero category
  // is guaranteed at least one tick — otherwise a small-but-real category
  // vanishes from the meter while still sitting in the legend, which reads as a
  // bug.
  const tickColors = useMemo(() => {
    const active = slices.filter((s) => s.amount > 0);
    if (active.length === 0 || total <= 0) return Array<string>(TICKS).fill(emptyColor);

    const exact = active.map((s) => (s.amount / total) * TICKS);
    // Guaranteed minimum only holds while there's a tick to spare for each.
    const min = active.length <= TICKS ? 1 : 0;
    const counts = exact.map((e) => Math.max(min, Math.floor(e)));

    let assigned = counts.reduce((sum, c) => sum + c, 0);
    // Flooring leaves ticks over; the minimum can borrow too many. Settle up
    // against the largest remainders / largest slices so the drift lands where
    // it's least visible.
    while (assigned < TICKS) {
      let best = 0;
      for (let i = 1; i < counts.length; i++) {
        if (exact[i] - counts[i] > exact[best] - counts[best]) best = i;
      }
      counts[best] += 1;
      assigned += 1;
    }
    while (assigned > TICKS) {
      let best = -1;
      for (let i = 0; i < counts.length; i++) {
        if (counts[i] > min && (best === -1 || counts[i] > counts[best])) best = i;
      }
      if (best === -1) break;
      counts[best] -= 1;
      assigned -= 1;
    }

    const out: string[] = [];
    active.forEach((slice, i) => {
      for (let n = 0; n < counts[i]; n++) out.push(slice.color);
    });
    while (out.length < TICKS) out.push(emptyColor);
    return out.slice(0, TICKS);
  }, [slices, total, emptyColor]);

  return (
    <VStack className="gap-y-4">
      {/* Sized by aspect ratio rather than a fixed height so the viewBox fills
          the box exactly. With any letterboxing, the arc's baseline stops
          matching the box's, and the absolutely-positioned centre label drifts
          off it at some screen widths. */}
      <Box
        className="w-full"
        style={{ aspectRatio: VB_WIDTH / VB_HEIGHT }}
      >
        {/* Arc and centre label are stacked rather than drawn together: SvgText
            can't inherit the app's font styling or dark-mode colors, and the
            centre figure has to match every other amount on the screen. */}
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}>
          {tickColors.map((color, i) => {
            // Half a step in from each end, so the run is visually centred on
            // the arc rather than butting against the baseline.
            const angle = Math.PI + ((i + 0.5) / TICKS) * Math.PI;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return (
              <Line
                key={i}
                x1={CENTER_X + R_INNER * cos}
                y1={CENTER_Y + R_INNER * sin}
                x2={CENTER_X + R_OUTER * cos}
                y2={CENTER_Y + R_OUTER * sin}
                stroke={color}
                strokeWidth={7}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>

        {/* Sits just above the arc's baseline, in the widest part of the hole,
            so a long converted figure has the most room available to it. */}
        <VStack className="absolute inset-x-0 bottom-0 items-center pb-2 px-16">
          <Text className="text-sm text-secondary-950">{label}</Text>
          <Text bold className="text-2xl" numberOfLines={1} adjustsFontSizeToFit>
            {approx ? "≈ " : ""}
            {formatAmount(total, currency)}
          </Text>
        </VStack>
      </Box>

      {/* Full-width rows rather than the two-up grid a meter like this usually
          gets: this legend replaced the old "Spending by Category" card, so it
          carries the share AND the amount, and neither survives being squeezed
          into half a phone width. */}
      <VStack className="gap-y-3">
        {slices
          .filter((s) => s.amount > 0)
          .map((slice) => (
            <HStack key={slice.key} className="items-center gap-x-3">
              <Box
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <Text className="flex-1" numberOfLines={1}>
                {slice.label}
              </Text>
              <Text className="text-sm text-secondary-950">
                {slice.pct.toFixed(0)}%
              </Text>
              <Text className="font-medium">
                {approx ? "≈ " : ""}
                {formatAmount(slice.amount, currency)}
              </Text>
            </HStack>
          ))}
      </VStack>
    </VStack>
  );
}
