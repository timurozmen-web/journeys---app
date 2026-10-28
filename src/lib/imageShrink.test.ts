import { describe, expect, it } from 'vitest';
import { fitWithin } from './imageShrink';

describe('fitWithin', () => {
  it('brings a phone photo down to 1,600px on its long side', () => {
    expect(fitWithin(4032, 3024)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ w: 1200, h: 1600 });
  });
  it('leaves a small photo as it is', () => {
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it('gives nothing for an image with no size', () => {
    expect(fitWithin(0, 600)).toEqual({ w: 0, h: 0 });
  });
});
