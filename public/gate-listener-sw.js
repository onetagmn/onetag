// Service worker for the OneTag gate reader kiosk page.
//
// Two jobs, both deliberately narrow in scope:
//
// 1. App-shell caching — so if this device loses power or the browser
//    restarts while offline, the gate-listener page itself still loads
//    (network-first, falling back to the last cached copy). Without this,
//    an offline device that reboots shows a browser error instead of the
//    reader UI, and staff can't log any taps until connectivity returns —
//    even taps for kids who are standing right there.
//
// 2. Background Sync wake-up — when the OS/browser fires a registered
//    'onetag-gate-flush' sync event (typically shortly after connectivity
//    returns), this tells any open gate-listener tab to flush its queue
//    right away instead of waiting for its next periodic retry.
//
// IMPORTANT LIMITATION: this service worker does NOT read the offline
// queue or POST to the API directly — the queue and the device's config
// (school ID + gate key) live in the page's IndexedDB/localStorage, and
// localStorage isn't reachable from a service worker. So Background Sync
// here only helps while the gate-listener tab is still open in the
// background; it will not silently flush taps if the tab was fully closed.
// In practice the gate reader runs as an always-open kiosk tab, so this
// covers the real deployment. If that ever changes, the flush logic
// should be ported into this file against IndexedDB directly.

const CACHE_NAME = 'onetag-gate-shell-v1';
const SHELL_URLS = ['/gate-listener.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isShellRequest = event.request.mode === 'navigate' || SHELL_URLS.includes(url.pathname);
  if (!isShellRequest) return; // let everything else (API calls, etc.) hit the network normally

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put('/gate-listener.html', copy));
        return response;
      })
      .catch(() => caches.match('/gate-listener.html'))
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag !== 'onetag-gate-flush') return;
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage('onetag-gate-flush'));
    })
  );
});
