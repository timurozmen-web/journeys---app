import { useLocation, useNavigate } from 'react-router-dom';

// How a form (or a page of something you can delete) leaves once it's
// done. Saving went on to the trip page with a push, so Back from there
// landed on the form just saved, and after deleting a trip Back opened
// the trip that no longer existed. Now a form opened from a screen
// (state.back) returns to it, and one opened from the + replaces itself
// with where its work went, so Back never lands on a finished form.

export interface OpenedFrom {
  /** Opened from a screen to return to once done. */
  back?: boolean;
  /** Marked in sessionStorage on save, so a list of imported bookings knows which are done. */
  savedMark?: string;
}

const depth = () => (window.history.state as { idx?: number } | null)?.idx ?? 0;

export function useFinish() {
  const navigate = useNavigate();
  const state = (useLocation().state ?? null) as OpenedFrom | null;
  return {
    /** Saved: back to the screen that opened the form, or on to `fallback` in its place. */
    done(fallback: string, fallbackState?: unknown) {
      if (state?.savedMark) {
        try { sessionStorage.setItem(state.savedMark, '1'); } catch { /* the list just won't tick it */ }
      }
      if (state?.back && depth() >= 1) navigate(-1);
      else navigate(fallback, { replace: true, state: fallbackState });
    },
    /**
     * Deleted: back past the screens showing what's gone (`steps`: 2 from a
     * trip's edit form skips the trip page too), or to `fallback`.
     */
    gone(fallback: string, steps = 1) {
      if (state?.back && depth() >= steps) navigate(-steps);
      else navigate(fallback, { replace: true });
    },
  };
}
