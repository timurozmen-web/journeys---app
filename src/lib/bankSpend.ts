import type { BankSpendRow } from './earning';

export interface LinkedAccount {
  id: string;
  paymentCardId: string | null;
  syncedThrough: string | null;
}
export interface SpendRecord extends BankSpendRow { accountId: string }

// Groups synced purchases by the rewards card their account feeds. A card
// only appears here once an account mapped to it has synced at least once:
// until then there is no bank data, so the card keeps using what you
// logged by hand instead of showing £0. Once it appears (even with no
// purchases yet) it counts as connected and the bank is the only source.
export function groupBankSpend(accounts: LinkedAccount[], spend: SpendRecord[]): Record<string, BankSpendRow[]> {
  const cardOfAccount = new Map<string, string>();
  const out: Record<string, BankSpendRow[]> = {};
  for (const a of accounts) {
    if (!a.paymentCardId || !a.syncedThrough) continue;
    cardOfAccount.set(a.id, a.paymentCardId);
    out[a.paymentCardId] ??= [];
  }
  for (const s of spend) {
    const cardId = cardOfAccount.get(s.accountId);
    if (cardId) out[cardId].push({ date: s.date, amount: s.amount, currency: s.currency, merchant: s.merchant });
  }
  return out;
}
