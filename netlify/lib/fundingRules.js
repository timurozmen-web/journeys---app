// Some rewards cards are paid for from a current account, so their
// purchases arrive as ordinary lines on that account. Each rule says how
// to recognise a card's purchases there.
//
// Marriott Debit is a Currensea card funded from Monzo. In Monzo its
// purchases are labelled "Mbv" plus a running number and then the merchant,
// e.g. "Mbv04 Courtyard By Marriott", "Mbv05 Zola.Comregi" (pattern given by
// the cardholder from their own statement). Only lines like that count; the
// rest of the account's spending doesn't belong to the card. The prefix is
// dropped so the merchant is recognised by name.
export const FUNDING_RULES = {
  'Marriott Debit': { pattern: /^\s*mbv\d+\b/i, prefix: /^\s*mbv\d+\s*/i },
};

// A spend row for `txn` if it is one of this card's purchases on the
// funding account, otherwise null. The pattern is what proves it is a
// purchase, so the bank's own category isn't relied on (a payment routed
// through Currensea may not be categorised as a card purchase); money
// coming in (a refund) is not spend.
export function fundingSpendRow(rule, txn) {
  const text = [txn.description, txn.merchant_name].find((t) => typeof t === 'string' && rule.pattern.test(t));
  if (!text) return null;
  const raw = Number(txn.amount);
  if (!Number.isFinite(raw) || raw >= 0) return null;
  const externalId = txn.transaction_id || txn.normalised_provider_transaction_id;
  if (!externalId || !txn.timestamp) return null;
  return {
    external_id: String(externalId),
    txn_date: String(txn.timestamp).slice(0, 10),
    amount: Math.round(-raw * 100) / 100,
    currency: txn.currency || 'GBP',
    merchant: text.replace(rule.prefix, '').trim().slice(0, 120) || null,
  };
}
