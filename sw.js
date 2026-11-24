// Service worker: guarda la app para que abra sin internet.
const VERSION = 'horario-al-dia-v1';
const ARCHIVOS = [
  './', './index.html', './licencia.js', './licencia-publica.js', './manifest.webmanifest',
  './Plantilla-Horario-al-Dia.xlsx',
  './iconos/icono-192.png', './iconos/icono-512.png', './iconos/icono-maskable-512.png', './iconos/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero lo guardado; si no está, internet. Si hay internet, se actualiza en segundo plano.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(guardado => {
      const red = fetch(e.request).then(r => {
        if (r && r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); }
        return r;
      }).catch(() => guardado);
      return guardado || red;
    })
  );
});
