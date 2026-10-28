import { describe, expect, it } from 'vitest';
import { aspectPhoto, propertyReview } from './reviewSummary';
import type { Review, ReviewPhoto } from '../types';

const review = (over: Partial<Review>): Review => ({
  id: 'r', hotelId: null, hotelName: 'W Melbourne', country: 'Australia', date: '2026-05-01', category: 'overall', score: 8, note: null, ...over,
});
const photo = (over: Partial<ReviewPhoto>): ReviewPhoto => ({
  id: 'p', hotelName: 'W Melbourne', hotelId: null, category: 'overall', url: 'u', path: 'x', createdAt: '2026-05-02T10:00:00Z', ...over,
});

describe('propertyReview', () => {
  const reviews = [
    review({ id: 'a', date: '2025-03-01', score: 9, note: 'Rooftop pool' }),
    review({ id: 'b', date: '2026-05-01', score: 7 }),
    review({ id: 'c', hotelName: 'w melbourne ', category: 'shower', date: '2026-05-01', score: 4, note: 'Weak pressure' }),
    review({ id: 'd', hotelName: 'Park Hyatt Tokyo', score: 10 }),
  ];
  const photos = [
    photo({ id: 'p1', category: 'shower', createdAt: '2026-05-02T10:00:00Z' }),
    photo({ id: 'p2', category: 'shower', createdAt: '2026-05-03T10:00:00Z' }),
    photo({ id: 'p3', category: 'bed' }),
  ];

  it('averages each aspect over visits, whatever the name\'s case or spacing', () => {
    const r = propertyReview('W Melbourne', reviews, photos)!;
    expect(r.overall.score).toBe(8);
    expect(r.overall.count).toBe(2);
    expect(r.visits).toEqual(['2026-05-01', '2025-03-01']);
    expect(r.aspects.find((a) => a.key === 'shower')!.score).toBe(4);
    expect(r.aspects.find((a) => a.key === 'service')!.score).toBeNull();
  });

  // The latest visit had no note: the one written before still shows,
  // and an edit goes to the latest visit's review.
  it('keeps the last note written, and edits the latest visit', () => {
    const r = propertyReview('W Melbourne', reviews, photos)!;
    expect(r.overall.note).toBe('Rooftop pool');
    expect(r.overall.noteReviewId).toBe('b');
  });

  it('puts each photo with its aspect, newest first', () => {
    const r = propertyReview('W Melbourne', reviews, photos)!;
    expect(r.aspects.find((a) => a.key === 'shower')!.photos.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(r.aspects.find((a) => a.key === 'bed')!.photos.map((p) => p.id)).toEqual(['p3']);
  });

  it('is there for a hotel with photos and no review yet, and not for one with neither', () => {
    expect(propertyReview('Aman Kyoto', [], [photo({ hotelName: 'Aman Kyoto' })])!.overall.score).toBeNull();
    expect(propertyReview('Aman Kyoto', reviews, photos)).toBeNull();
  });
});

describe('aspectPhoto', () => {
  const photos = [photo({ id: 'bed', category: 'bed' }), photo({ id: 'shower', category: 'shower', createdAt: '2026-06-01T00:00:00Z' })];
  it('shows the aspect\'s own photo, and only that', () => {
    expect(aspectPhoto(photos, 'W Melbourne', 'bed')!.id).toBe('bed');
    expect(aspectPhoto(photos, 'W Melbourne', 'food')).toBeNull();
  });
  it('falls back to the newest photo for overall', () => {
    expect(aspectPhoto(photos, 'w melbourne', 'overall')!.id).toBe('shower');
  });
});
