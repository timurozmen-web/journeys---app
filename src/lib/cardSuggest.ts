import { CARDS_STATIC } from '../data/cardDefs';

// A best guess at which rewards card a bank account or card is, from its
// name ("Marriott Bonvoy American Express Card" -> Marriott Amex). It only
// suggests; the user confirms. Returns null when it can't tell.
export function suggestCard(displayName: string, providerName: string | null = null): string | null {
  const text = `${displayName} ${providerName ?? ''}`.toLowerCase();
  const hits = CARDS_STATIC.filter((c) => text.includes(c.programmeBrand.split(' ')[0].toLowerCase()));
  if (hits.length === 1) return hits[0].id;
  if (hits.length > 1 && /amex|american express/.test(text)) return hits.find((c) => /amex/i.test(c.id))?.id ?? null;
  return null;
}
