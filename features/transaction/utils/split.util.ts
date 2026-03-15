export const getAmountPerPerson = (
  totalAmount: number,
  peopleCount: number
) => {
  if (peopleCount === 0) return [];
  const amounts: number[] = [];
  let sum = 0;
  const share = totalAmount / peopleCount;
  for (let i = 0; i < peopleCount - 1; i++) {
    const amt = parseFloat(share.toFixed(2));
    amounts.push(amt);
    sum += amt;
  }
  // Assign remainder to last member
  amounts.push(parseFloat((totalAmount - sum).toFixed(2)));
  return amounts;
};

export const getPercentagePerPerson = (peopleCount: number) => {
  if (peopleCount === 0) return [];
  const percentages: number[] = [];
  let sum = 0;
  for (let i = 0; i < peopleCount - 1; i++) {
    const pct = parseFloat((100 / peopleCount).toFixed(2));
    percentages.push(pct);
    sum += pct;
  }
  percentages.push(parseFloat((100 - sum).toFixed(2)));
  return percentages;
};
