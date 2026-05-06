/* ordify · service worker
 * Strategy: network-first for navigation (so updates land immediately on
 * good network), cache-first for versioned static assets, stale-while-revalidate
 * for the rest. Cache name is bumped on every release.
 */
'use strict';

const CACHE = 'ordify-v3';
const CORE = [
    './',
    './index.html',
    './style.css?v=3',
    './app.js?v=3',
    './omni.js?v=3',
    './manifest.webmanifest',
    './icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(CORE).catch(() => {}))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Never intercept Anthropic / Google / external API calls
    if (url.origin !== location.origin) return;

    // Navigation: network-first, fall back to cached index.html
    if (req.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const fresh = await fetch(req);
                const cache = await caches.open(CACHE);
                cache.put('./index.html', fresh.clone()).catch(() => {});
                return fresh;
            } catch (e) {
                const cache = await caches.open(CACHE);
                return (await cache.match('./index.html')) || Response.error();
            }
        })());
        return;
    }

    // Static asset (versioned via ?v=): cache-first
    if (url.search.includes('v=')) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE);
            const hit = await cache.match(req);
            if (hit) return hit;
            try {
                const fresh = await fetch(req);
                cache.put(req, fresh.clone()).catch(() => {});
                return fresh;
            } catch (e) { return hit || Response.error(); }
        })());
        return;
    }

    // Everything else: stale-while-revalidate
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        const fetcher = fetch(req).then(res => {
            if (res.ok) cache.put(req, res.clone()).catch(() => {});
            return res;
        }).catch(() => null);
        return cached || (await fetcher) || Response.error();
    })());
});
