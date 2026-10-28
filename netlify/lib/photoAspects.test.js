import { describe, expect, test } from 'vitest';
import { PHOTO_ASPECTS, PHOTO_SCHEMA, aspectsByPhoto } from './photoAspects.js';
import { REVIEW_CATEGORIES } from '../../src/lib/reviewScoring.ts';

describe('aspectsByPhoto', () => {
  test('gives each photo its aspects in the order sent, several where it shows several', () => {
    const answer = { photos: [{ photo: 2, aspects: ['shower'] }, { photo: 1, aspects: ['bed', 'room'] }] };
    expect(aspectsByPhoto(2, answer)).toEqual([['room', 'bed'], ['shower']]);
  });
  test('puts a photo the answer missed, or gave nothing real, under overall', () => {
    const answer = { photos: [{ photo: 1, aspects: ['value', 'lobby'] }, { photo: 7, aspects: ['food'] }] };
    expect(aspectsByPhoto(2, answer)).toEqual([['overall'], ['overall']]);
    expect(aspectsByPhoto(1, null)).toEqual([['overall']]);
  });
  test('merges a photo answered twice', () => {
    expect(aspectsByPhoto(1, { photos: [{ photo: 1, aspects: ['food'] }, { photo: 1, aspects: ['facilities'] }] })).toEqual([['food', 'facilities']]);
  });
});

describe('the aspects', () => {
  test('are the review\'s own categories, all but Value', () => {
    const keys = REVIEW_CATEGORIES.map((c) => c.key);
    expect(PHOTO_ASPECTS.every((a) => keys.includes(a))).toBe(true);
    expect(keys.filter((k) => !PHOTO_ASPECTS.includes(k))).toEqual(['value']);
  });
  test('the answer schema closes every object, as structured outputs require', () => {
    expect(PHOTO_SCHEMA.additionalProperties).toBe(false);
    expect(PHOTO_SCHEMA.properties.photos.items.additionalProperties).toBe(false);
  });
});
