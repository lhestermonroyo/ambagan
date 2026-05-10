import { currencies } from "@/utils/constants";

export function groupByCurrency(
  items: { amount: number; currency: string }[]
): { currency: string; amount: number }[] {
  const map: Record<string, number> = {};
  items.forEach(({ amount, currency }) => {
    map[currency] = (map[currency] ?? 0) + amount;
  });
  return Object.entries(map).map(([currency, amount]) => ({
    currency,
    amount
  }));
}

export function getCurrencySign(currency: string): string | undefined {
  return currencies.find((c) => c.value === currency)?.sign;
}

export function getCurrencyLabel(currency: string): string | undefined {
  return currencies.find((c) => c.value === currency)?.label;
}
