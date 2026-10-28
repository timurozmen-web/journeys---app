// Sorting a stay's photos into the review's aspects. A photo can show
// several (a bedroom is the room and the bed); Value has no photo of its
// own. The keys are the review categories' (src/lib/reviewScoring.ts).
export const PHOTO_ASPECTS = ['overall', 'room', 'bed', 'shower', 'food', 'facilities', 'service'];
export const MAX_PHOTOS = 10;

export const PHOTO_SYSTEM = `You sort a traveller's photos of a hotel stay into the aspects of their review. Each photo gets every aspect it clearly shows, often more than one, and none that is a stretch.

Aspects:
- overall: the hotel as a whole: the building, entrance, grounds, or a view that shows the property.
- room: the bedroom or suite as a space: the room seen from the door, the sitting area, desk, wardrobe, the window or the view from the room.
- bed: the bed is plainly in the picture. A bedroom showing its bed is both room and bed.
- shower: the bathroom: shower, bath, basin, toiletries.
- food: anything to eat or drink: breakfast, the restaurant, the bar, room service, the minibar, lounge food.
- facilities: shared spaces and amenities: pool, gym, spa, club lounge, rooftop, beach, lobby.
- service: the staff or something they did: a welcome gift or note, turndown, the check-in desk.

A photo that shows none of these clearly is overall. Photos are numbered in the order given; answer for every number.`;

// What the model must answer: one entry per photo number. Photo numbers
// stay out of the schema (an enum of them would make each batch size a new
// schema to compile) and are checked here instead.
export const PHOTO_SCHEMA = {
  type: 'object',
  properties: {
    photos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          photo: { type: 'integer' },
          aspects: { type: 'array', items: { type: 'string', enum: PHOTO_ASPECTS } },
        },
        required: ['photo', 'aspects'],
        additionalProperties: false,
      },
    },
  },
  required: ['photos'],
  additionalProperties: false,
};

// Each photo's aspects, in the order the photos were sent. Anything the
// answer leaves out, or an aspect that isn't one, falls back to overall,
// so every photo lands somewhere it can be moved from.
export function aspectsByPhoto(count, answer) {
  const result = Array.from({ length: count }, () => []);
  for (const entry of Array.isArray(answer?.photos) ? answer.photos : []) {
    const i = Number(entry?.photo) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= count || !Array.isArray(entry.aspects)) continue;
    const given = new Set(entry.aspects);
    result[i] = PHOTO_ASPECTS.filter((a) => given.has(a) || result[i].includes(a));
  }
  return result.map((a) => (a.length ? a : ['overall']));
}
