const CACHE_NAME = "cazeexchange-pwa-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html"
];

// Instalar el Service Worker y almacenar en caché el HTML básico
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activar el Service Worker y limpiar cachés viejas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Red primero, con caída a Caché para que las tasas siempre estén al día si hay red
self.addEventListener("fetch", (event) => {
  // Solo interceptar peticiones de navegación y assets estáticos locales
  const url = new URL(event.request.url);
  if (
    event.request.method === "GET" &&
    url.origin === self.location.origin &&
    !url.pathname.startsWith("/api/")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Guardar copia en caché si la respuesta es válida
          if (response && response.status === 200) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseCopy);
            });
          }
          return response;
        })
        .catch(() => {
          // Si no hay internet, buscar en la caché
          return caches.match(event.request);
        })
    );
  }
});
