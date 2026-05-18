export const generatePaymentSplits = (
  payers: { userId: string; amount: number }[],
  memberSplits: { userId: string; amount: number; percentage: number }[]
): { memberSplitId: string; payerId: string; amount: number }[] => {
  // Step 1: net per person = paid - owed
  const netMap: Record<string, number> = {};

  for (const payer of payers) {
    netMap[payer.userId] = (netMap[payer.userId] || 0) + payer.amount;
  }
  for (const split of memberSplits) {
    netMap[split.userId] = (netMap[split.userId] || 0) - split.amount;
  }

  // Step 2: bucket into creditors (net > 0) and debtors (net < 0)
  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];

  for (const [userId, net] of Object.entries(netMap)) {
    if (net > 0.001) creditors.push({ userId, amount: net });
    else if (net < -0.001) debtors.push({ userId, amount: -net });
  }

  // Sort descending so the largest balances are settled first
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Step 3: greedy matching — largest debtor pays largest creditor
  const result: { memberSplitId: string; payerId: string; amount: number }[] =
    [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const settled = parseFloat(
      Math.min(creditor.amount, debtor.amount).toFixed(2)
    );

    result.push({
      memberSplitId: debtor.userId,
      payerId: creditor.userId,
      amount: settled
    });

    creditor.amount = parseFloat((creditor.amount - settled).toFixed(2));
    debtor.amount = parseFloat((debtor.amount - settled).toFixed(2));

    if (creditor.amount < 0.001) i++;
    if (debtor.amount < 0.001) j++;
  }

  return result;
};

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
