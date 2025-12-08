const CACHE_NAME = 'calc-energia-v2'; // Incrementé la versión para forzar actualización
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './Scripts/common.js',
  './Scripts/login.js',
  './Scripts/artefactos.js',
  './Scripts/consumo.js',
  './Scripts/corrientes.js',
  './Scripts/facturas.js',
  
  // Librerías Core (jQuery)
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.css',

  // Librerías PDF (Agregadas para que funcionen Offline)
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js',

  // Iconos (Idealmente deberías descargarlos, pero esto ayuda si el CDN lo permite)
  'https://cdn-icons-png.flaticon.com/512/2933/2933886.png'
];

// Instalación: Cachear TODO lo crítico
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Fuerza al SW a activarse de inmediato
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cacheando App Shell y Librerías');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activación: Limpiar cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Eliminando caché antigua:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim(); // Controlar la página inmediatamente sin recargar
});

// Estrategia de Red: Cache First, falling back to Network
// (Mejor para apps que deben cargar rápido y funcionar offline)
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET (como subidas a Firebase)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 1. Si está en caché, devolverlo
        if (response) {
            return response;
        }
        // 2. Si no, buscar en la red
        return fetch(event.request).then((networkResponse) => {
            // Opcional: Cachear dinámicamente nuevas peticiones (ej: imágenes de artefactos si las tuvieras)
            return networkResponse;
        }).catch(() => {
            // 3. Si falla la red y no está en caché (Offline total)
            console.log("Recurso no disponible offline:", event.request.url);
        });
      })
  );
});