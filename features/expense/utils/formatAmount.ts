export const formatAmount = (amount: number, currency: string = "PHP") => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency
  }).format(amount);
};
