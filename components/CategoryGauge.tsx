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
  /**
   * Marks THIS slice's amount as converted, independently of the total. A
   * category paid for entirely in the gauge's own currency is an exact figure
   * and must print as one, even when the category beside it folded in yen.
   * Falls back to the gauge-wide `approx` when unset.
   */
  approx?: boolean;
};

/** Tick count across the whole arc, and the only real lever on how heavy the
 *  ticks look: TICK_WIDTH below divides the arc by this, so fewer ticks means
 *  fatter ones. Kept high enough that a ~3% slice still reads as more than a
 *  rounding artifact — below that, the minimum-one-tick guarantee is doing the
 *  work rather than the proportions. */
const TICKS = 32;

// Drawn in a fixed viewBox and scaled by the SVG's own aspect ratio, so the
// geometry never has to care about the real pixel width.
const VB_WIDTH = 280;
const CENTER_X = VB_WIDTH / 2;
const CENTER_Y = 132;
const R_OUTER = 128;
const R_INNER = 94;
const VB_HEIGHT = CENTER_Y + 6;

/** Ticks are radial, so they crowd hardest at the inner radius — that pitch is
 *  what the stroke has to fit inside. Hardcoding a width instead let the ticks
 *  overlap at the inner end, which read as a solid blob wherever they stack
 *  vertically (the flat ends of the arc). */
const TICK_GAP = 2;
const TICK_WIDTH = (Math.PI / TICKS) * R_INNER - TICK_GAP;

/**
 * Where the money went, as a semi-circle meter: one tick per ~2% of spend, colored
 * by category, with the total in the middle and a labelled legend underneath.
 *
 * Shared by the book Stats tab and both views of the group Stats tab — same
 * question in all three, so it gets the same answer.
 *
 * This is the home for the category story, which had two bad homes before it: a
 * 2px sliver of the book budget card's progress bar, where six categories were
 * six unlabelled slivers under a legend that wrapped onto three lines; and a
 * standalone "Spending by Category" card on the group tabs, a stack of one bar
 * per category that spent a full screen saying what this arc says at a glance.
 * Folding it into the total's own card shows the split at a size where each
 * slice is readable, and the legend can still carry both share and amount.
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
  /** Marks the centre figure as converted — it spans every slice, so one
   *  converted category makes the total approximate. Legend rows take their own
   *  {@link GaugeSlice.approx} first and only fall back to this. */
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
    if (active.length === 0 || total <= 0)
      return Array<string>(TICKS).fill(emptyColor);

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
        if (counts[i] > min && (best === -1 || counts[i] > counts[best]))
          best = i;
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
      <Box className="w-full" style={{ aspectRatio: VB_WIDTH / VB_HEIGHT }}>
        {/* Arc and centre label are stacked rather than drawn together: SvgText
            can't inherit the app's font styling or dark-mode colors, and the
            centre figure has to match every other amount on the screen. */}
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        >
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
                strokeWidth={TICK_WIDTH}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>

        {/* Sits just above the arc's baseline, in the widest part of the hole,
            so a long converted figure has the most room available to it. */}
        <VStack className="absolute inset-x-0 bottom-0 items-center pb-2 px-16">
          <Text className="text-sm text-secondary-950">{label}</Text>
          <Text
            bold
            className="text-2xl"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
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
                {(slice.approx ?? approx) ? "≈ " : ""}
                {formatAmount(slice.amount, currency)}
              </Text>
            </HStack>
          ))}
      </VStack>
    </VStack>
  );
}
