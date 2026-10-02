// Addresses the service worker must leave alone and let reach the server.
// Bug this fixes: the PWA's service worker answers every page navigation
// with the app's index.html. The bank sends the user back to
// /bank-link-callback, so the device showed the app's home screen instead
// of running the function that finishes the link: nothing was saved and no
// error appeared, on every attempt.
export const SW_NAVIGATION_DENYLIST: RegExp[] = [/^\/bank-link-callback/, /^\/\.netlify\//];
