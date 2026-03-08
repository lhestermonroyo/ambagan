export const getAmountPerPerson = (
  totalAmount: number,
  peopleCount: number
) => {
  if (peopleCount === 0) return 0;

  return totalAmount / peopleCount;
};

export const getPercentagePerPerson = (peopleCount: number) => {
  if (peopleCount === 0) return 0;

  return 100 / peopleCount;
};
