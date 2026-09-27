import { describe, expect, test } from 'vitest';
import { cardBackground, luminance, shade, textOn, tierFinish } from './cardTheme';

describe('tierFinish', () => {
  test('matches the tier names programmes actually use', () => {
    expect(tierFinish('Titanium Elite')).toBe('titanium');
    expect(tierFinish('Gold')).toBe('gold');
    expect(tierFinish('Elite Silver')).toBe('silver');
    expect(tierFinish('Platinum')).toBe('platinum');
    expect(tierFinish('Diamond')).toBe('diamond');
    expect(tierFinish('Ambassador')).toBe('ambassador');
  });

  test('Platinum One is the top Qantas tier, not plain platinum', () => {
    expect(tierFinish('Platinum One')).toBe('ambassador');
  });

  test('no tier, or an entry-level one, gets the plain finish', () => {
    expect(tierFinish(undefined)).toBe('base');
    expect(tierFinish('Member')).toBe('base');
    expect(tierFinish('Blue')).toBe('base');
  });
});

describe('colours', () => {
  test('shade mixes toward white or black', () => {
    expect(shade('#000000', 0.5)).toBe('#808080');
    expect(shade('#FFFFFF', -0.5)).toBe('#808080');
    expect(shade('#123456', 0)).toBe('#123456');
  });

  test('short hex and bad input are handled', () => {
    expect(shade('#fff', -1)).toBe('#000000');
    expect(shade('not-a-colour', 0.3)).toBe('not-a-colour');
  });

  test('luminance runs from black to white', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#FFFFFF')).toBeCloseTo(1);
  });

  test('white text on dark brand colours, dark text on light ones', () => {
    expect(textOn('#012F60')).toBe('#FFFFFF'); // Hilton navy
    expect(textOn('#E40000')).toBe('#FFFFFF'); // Qantas red
    expect(textOn('#FFD200')).toBe('#0B0D12'); // a light yellow
  });

  test('card background uses the brand colour, with a safe fallback', () => {
    expect(cardBackground('#012F60')).toContain('#012F60');
    expect(cardBackground('')).toBe('var(--card2)');
  });
});
