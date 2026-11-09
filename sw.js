/* CAJET — service worker : permet d'ouvrir l'application sans réseau.
   Il ne met en cache que la page de l'application (jamais les données ni Firebase).
   À placer dans le MÊME dossier que index.html. Pour forcer une mise à jour chez tous
   les utilisateurs après une modification de index.html, changez le numéro de VERSION. */
const VERSION = 'v2';
const CACHE = 'cajet-page-' + VERSION;
const PAGE = new URL('./', self.registration.scope).href;
const FILES = [PAGE, new URL('index.html', self.registration.scope).href];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(FILES.map(u => fetch(u, { cache: 'reload' }).then(r => r.ok && c.put(u, r)).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('cajet-page-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          /* Firebase et autres sites : jamais interceptés */
  const isPage = req.mode === 'navigate' || req.destination === 'document';
  if (!isPage) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const r = await fetch(req);                           /* réseau d'abord : on a toujours la dernière version */
      if (r && r.ok) { cache.put(PAGE, r.clone()); }
      return r;
    } catch (err) {                                         /* pas de réseau : version enregistrée (les ?e=...&r=... sont ignorés) */
      return (await cache.match(req, { ignoreSearch: true })) || (await cache.match(PAGE)) ||
             new Response('Application indisponible hors connexion : ouvrez-la une première fois avec Internet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
