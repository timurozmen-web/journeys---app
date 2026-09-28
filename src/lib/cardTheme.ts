// Colour logic for the wallet's themed cards: every loyalty programme or
// payment card is drawn in its own brand colour, with a metallic tier
// chip, so each pane feels like the card it represents.

export type TierFinish = 'ambassador' | 'diamond' | 'titanium' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'base';

// Matched on words in the programme's own tier name ("Titanium Elite",
// "Gold", "Platinum One", "Elite Silver"...). Order matters: the most
// specific or highest tiers are checked first.
const FINISH_WORDS: [TierFinish, RegExp][] = [
  ['ambassador', /ambassador|platinum one|pps/i],
  ['diamond', /diamond|globalist/i],
  ['titanium', /titanium/i],
  ['platinum', /platinum/i],
  ['gold', /gold/i],
  ['silver', /silver/i],
  ['bronze', /bronze/i],
];

export function tierFinish(tier: string | null | undefined): TierFinish {
  if (!tier) return 'base';
  for (const [finish, re] of FINISH_WORDS) if (re.test(tier)) return finish;
  return 'base';
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Mixes a colour toward white (amount > 0) or black (amount < 0).
export function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex(rgb.map((v) => v + (target - v) * t) as [number, number, number]);
}

// WCAG relative luminance, 0 (black) to 1 (white).
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Text colour that stays readable on the card: white on dark brand
// colours (nearly all of them), near-black on the rare light one.
export function textOn(hex: string): string {
  return luminance(hex) > 0.35 ? '#0B0D12' : '#FFFFFF';
}

// The card face: the brand colour lifted slightly at the top-left and
// deepened at the bottom-right, so it reads as a physical card.
export function cardBackground(hex: string): string {
  if (!parseHex(hex)) return 'var(--card2)';
  return `linear-gradient(150deg, ${shade(hex, 0.12)} 0%, ${hex} 48%, ${shade(hex, -0.35)} 100%)`;
}
