const CACHE_NAME = 'calc-energia-v1';
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
  // Librerías externas críticas (jQuery)
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.css'
];

// Instalación: Cachear recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cacheando archivos globales');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activación: Limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
});

// Intercepción de red: Estrategia Stale-While-Revalidate o Cache-First
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si está en caché, devuélvelo. Si no, búscalo en red.
        return response || fetch(event.request).then((fetchRes) => {
            // Opcional: Podrías cachear dinámicamente aquí lo que vayas descargando
            return fetchRes;
        });
      })
  );
});