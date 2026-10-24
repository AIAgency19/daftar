/* Service worker: zorgt dat de app offline werkt.
   - App-bestanden: direct uit de cache, op de achtergrond bijgewerkt (nieuwe versie zichtbaar bij de volgende start).
   - Lesstof en voortgang komen uit Supabase; die verzoeken gaan altijd rechtstreeks naar het netwerk.
   - Lettertypen (fonts/) en de Supabase-bibliotheek (vendor/) staan in het project zelf en horen bij de app-bestanden. */
/* 'dev' tijdens het testen; tools/build-www.js vervangt dit bij elke build door een eigen versie (git-hash en tijd) */
const SHELL = 'daftar-shell-5a787b8-20261024025342';
const RUNTIME = 'daftar-runtime';
const FILES = ['./', 'index.html', 'styles.css', 'js/config.js', 'js/logic.js', 'js/boot.js', 'js/app.js', 'manifest.webmanifest',
  'vendor/supabase.js', 'fonts/fonts.css', 'fonts/amiri-400-arabic.woff2', 'fonts/amiri-700-arabic.woff2',
  'fonts/figtree-latin.woff2', 'fonts/figtree-latin-ext.woff2',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(cache => cache.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname.endsWith('/content/content.json')) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then(c => c.put(url.pathname, copy)); }
      return res;
    }).catch(() => caches.open(RUNTIME).then(c => c.match(url.pathname))));
    return;
  }
  if (url.origin === location.origin) e.respondWith(staleWhileRevalidate(req, SHELL));
});
