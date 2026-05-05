// ordify.me — Service Worker (offline-first cache)
//
// Strategy:
//   • App shell (HTML/CSS/JS/icons) → cache-first; updated on activate
//   • Fonts (gstatic) → stale-while-revalidate so they're available offline
//   • API calls (Anthropic / Google) → network-only, no caching (privacy)
//
// Bumping CACHE_VERSION evicts old caches on next activate.

const CACHE_VERSION = 'ordify-v42';
const SHELL = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/icon-192.svg',
    '/icon-512.svg',
    '/css/tokens.css?v=42',
    '/css/styles.css?v=42',
    '/js/icons.js?v=42',
    '/js/dom.js?v=42',
    '/js/i18n.js?v=42',
    '/js/store.js?v=42',
    '/js/ai.js?v=42',
    '/js/google.js?v=42',
    '/js/gmail.js?v=42',
    '/js/gcal.js?v=42',
    '/js/crypto.js?v=42',
    '/js/sheets.js?v=42',
    '/js/files.js?v=42',
    '/js/recorder.js?v=42',
    '/js/snapshots.js?v=42',
    '/js/app.js?v=42',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL).catch(() => {}))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Never cache API calls — privacy + freshness
    const noCacheHosts = ['api.anthropic.com', 'api.openai.com', 'gmail.googleapis.com',
                          'sheets.googleapis.com', 'www.googleapis.com', 'accounts.google.com'];
    if (noCacheHosts.includes(url.hostname)) return;

    // Same-origin: cache-first, fall back to network, fall back to cached '/'
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(req).then(hit => {
                if (hit) return hit;
                return fetch(req).then(resp => {
                    // Cache successful responses for next time
                    if (resp.ok && (resp.type === 'basic' || resp.type === 'cors')) {
                        const clone = resp.clone();
                        caches.open(CACHE_VERSION).then(c => c.put(req, clone));
                    }
                    return resp;
                }).catch(() => caches.match('/index.html') || caches.match('/'));
            })
        );
        return;
    }

    // Google Fonts: stale-while-revalidate (cosmetic, not blocking)
    if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
        event.respondWith(
            caches.match(req).then(hit => {
                const fetchPromise = fetch(req).then(resp => {
                    const clone = resp.clone();
                    caches.open(CACHE_VERSION).then(c => c.put(req, clone));
                    return resp;
                }).catch(() => hit);
                return hit || fetchPromise;
            })
        );
    }
});
