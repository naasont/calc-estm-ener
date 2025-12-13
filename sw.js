const CACHE_NAME = 'calc-energia-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './Scripts/common.js',
  './Scripts/login.js',
  './Scripts/artefactos.js',
  './Scripts/consumo.js',
  './Scripts/corrientes.js',
  './Scripts/lecturas.js',
  './Assets/icons/icon.png',
  './Assets/images/logo.svg',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando activos...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((response) => {
        return response || fetch(event.request);
      })
      .catch(() => {
        console.log("Offline: Recurso no encontrado", event.request.url);
      })
  );
});