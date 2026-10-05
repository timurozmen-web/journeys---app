// How each card is drawn in the wallet. These are illustrations in each
// card's brand colours, not the issuers' artwork (which is copyrighted).
// A network mark is only given where the card's network is certain.
export interface CardFace {
  from: string;                    // gradient start (top-left)
  to: string;                      // gradient end (bottom-right)
  network?: 'amex' | 'mastercard';
  issuer?: string;                 // wordmark for the card's issuer where it isn't the network
}

export const CARD_FACES: Record<string, CardFace> = {
  'BA Amex Premium Plus': { from: '#1B2C52', to: '#080D1C', network: 'amex' },
  'BA Amex': { from: '#0B5CAB', to: '#062F5E', network: 'amex' },
  'Marriott Amex': { from: '#4B1A33', to: '#1A0A12', network: 'amex' },
  'Marriott Debit': { from: '#34343A', to: '#0E0E11', issuer: 'Currensea' },
  'Hilton Debit': { from: '#12508F', to: '#05223F', issuer: 'Currensea' },
  'IHG Revolut Elite': { from: '#26262B', to: '#000000', issuer: 'Revolut' },
  'Virgin Atlantic Mastercard+': { from: '#D3132F', to: '#6E0A1B', network: 'mastercard' },
};

// A card not in the table (added by hand, or new to the catalogue).
export const DEFAULT_FACE: CardFace = { from: '#3A3F4A', to: '#12151B' };
