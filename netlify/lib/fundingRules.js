// Some rewards cards are paid for from a current account, so their
// purchases arrive as ordinary lines on that account. Each rule says how
// to recognise a card's purchases there.
//
// Marriott Debit and Hilton Debit are Currensea cards funded from Monzo.
// In Monzo a purchase is labelled with a card prefix, a running number and
// then the merchant: "Mbv04 Courtyard By Marriott", "Mbv05 Zola.Comregi" for
// Marriott, "Hltn..." for Hilton (patterns given by the cardholder from
// their own statement). Only lines like that count; the rest of the
// account's spending doesn't belong to either card. The prefix is dropped
// so the merchant is recognised by name. The Hilton number is optional
// because only the "Hltn" prefix was stated, not the exact numbering.
export const FUNDING_RULES = {
  'Marriott Debit': { pattern: /^\s*mbv\d+\b/i, prefix: /^\s*mbv\d+\s*/i },
  'Hilton Debit': { pattern: /^\s*hltn\d*\b/i, prefix: /^\s*hltn\d*\s*/i },
};

// One current account can pay for several of these cards, so a mapped
// account is checked against every rule: the first that recognises a line
// says which card it belongs to.
export function matchFundingCard(rules, txn) {
  for (const [cardId, rule] of Object.entries(rules)) {
    const row = fundingSpendRow(rule, txn);
    if (row) return { cardId, row };
  }
  return null;
}

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
