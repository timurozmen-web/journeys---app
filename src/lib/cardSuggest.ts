import { CARDS_STATIC } from '../data/cardDefs';

// A best guess at which rewards card a bank account or card is, from its
// name ("Marriott Bonvoy American Express Card" -> Marriott Amex), using
// each catalogue card's own `detect` rule. It only suggests; the user
// confirms. Returns null when nothing in the catalogue fits.
export function suggestCard(displayName: string, providerName: string | null = null): string | null {
  const text = `${displayName} ${providerName ?? ''}`.toLowerCase();
  return CARDS_STATIC.find((c) => c.detect?.(text))?.id ?? null;
}
