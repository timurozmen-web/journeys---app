import { describe, expect, test } from 'vitest';
import { paceLine, spendPace } from './spendPace';

const base = { windowStart: '2026-01-01', windowEnd: '2026-07-01', today: '2026-04-01' }; // 90 of 181 days gone

describe('spendPace', () => {
  test('on track when the pace so far reaches the target in time', () => {
    const p = spendPace({ ...base, spent: 2000, target: 3000 }); // £2k in 90 days -> ~£4k by the end
    expect(p.status).toBe('open');
    expect(p.onTrack).toBe(true);
    expect(p.remaining).toBe(1000);
    expect(p.projected).toBeGreaterThan(3900);
  });

  test('behind when it would fall short, and says what is needed per month', () => {
    const p = spendPace({ ...base, spent: 500, target: 3000 });
    expect(p.onTrack).toBe(false);
    expect(p.remaining).toBe(2500);
    expect(p.daysLeft).toBe(91);
    expect(p.perMonthNeeded).toBeCloseTo(2500 / (91 / 30.44), 1); // about £836 a month
  });

  test('reached once spend meets the target', () => {
    expect(spendPace({ ...base, spent: 3000, target: 3000 })).toMatchObject({ status: 'reached', remaining: 0, onTrack: true });
  });

  test('closed once the window has ended without reaching it', () => {
    expect(spendPace({ ...base, today: '2026-07-02', spent: 100, target: 3000 })).toMatchObject({ status: 'closed', daysLeft: 0, onTrack: false });
  });

  test('day one of a window does not divide by zero', () => {
    const p = spendPace({ ...base, today: '2026-01-01', spent: 0, target: 3000 });
    expect(Number.isFinite(p.projected)).toBe(true);
    expect(p.status).toBe('open');
  });
});

describe('paceLine', () => {
  const base = { remaining: 1000, daysLeft: 1, perMonthNeeded: 1000.4, projected: 0, onTrack: false, status: 'open' as const };
  test('says what is needed, how long is left, and whether the pace gets there', () => {
    expect(paceLine(base)).toBe('£1,000/month to go · 1 day left · behind pace');
    expect(paceLine({ ...base, daysLeft: 40, onTrack: true })).toBe('£1,000/month to go · 40 days left · on track');
  });
  test('nothing to say once reached; says so once closed', () => {
    expect(paceLine({ ...base, status: 'reached' })).toBeNull();
    expect(paceLine({ ...base, status: 'closed' })).toBe('Window closed');
  });
});
