import { lazy, type ComponentType } from 'react';

// After a new deploy, a page that's already loaded in memory (very
// possible in a PWA that gets backgrounded/reopened rather than fully
// closed) can still try to fetch an old, content-hashed chunk filename
// that the previous session's bundle was built with -- if that exact
// file is no longer being served, the dynamic import() rejects, and
// since a rejected lazy() import throws into React's render rather than
// being caught by Suspense, it takes down the whole page with no
// visible error: a blank screen, exactly this class of bug.
//
// Fix: catch that specific failure and force one hard reload (via
// sessionStorage, so a genuinely broken chunk -- as opposed to a merely
// stale one -- doesn't reload forever). A normal page load afterwards
// picks up the current deploy's real chunk filenames.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (err) {
      const key = 'journeys-chunk-reload-attempted';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // Never resolves -- the reload is already in flight, and
        // returning here would flash a broken component first.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
