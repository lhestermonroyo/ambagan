import { getCurrencySign } from "@/utils/currency";

export const formatAmount = (amount: number, currency: string = "PHP") => {
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol"
  }).format(amount);

  // en-PH keeps the country prefix on foreign currencies ("US$5.00",
  // "SGD5.00") while the home currency gets the bare "₱5.00". Swap the prefix
  // for the app's own sign so every currency reads the same way — symbol then
  // amount. Currencies we don't carry a sign for keep the Intl output.
  const sign = getCurrencySign(currency);
  if (!sign) return formatted;

  return formatted.replace(/^(-?)[^\d-]*/, (_match, minus) => `${minus}${sign}`);
};
