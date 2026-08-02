/**
 * Text size for an amount that has to hold one line in a fixed box.
 *
 * The obvious tool for this is `adjustsFontSizeToFit`, and it is the wrong one:
 * on iOS it shrinks a flex-shrink Text far past what the box actually needs and
 * ignores `minimumFontScale` while doing it, which is how a ₱12,828.51 hero
 * ended up a few points tall inside a half-empty row. Stepping the class down
 * by length is deterministic, honours the design scale, and never disagrees
 * with what Yoga measured.
 *
 * `maxChars` is the caller's business because it is really a width: the same
 * figure has a full-bleed hero in one place and half a card in another.
 */
const SCALE = [
  "text-4xl",
  "text-3xl",
  "text-2xl",
  "text-xl",
  "text-lg",
  "text-base",
  "text-sm"
] as const;

export type AmountTextSize = (typeof SCALE)[number];

/** Roughly the extra characters one step down the scale buys back. */
const CHARS_PER_STEP = 2;

export function amountTextSize(
  base: AmountTextSize,
  value: string,
  maxChars: number
): AmountTextSize {
  const start = SCALE.indexOf(base);
  const over = value.length - maxChars;
  if (start === -1 || over <= 0) return base;

  const steps = Math.ceil(over / CHARS_PER_STEP);
  return SCALE[Math.min(start + steps, SCALE.length - 1)];
}
