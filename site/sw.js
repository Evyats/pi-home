const CACHE = 'pi-home-v4'
const APP_SHELL = ['/', '/home.css?v=4', '/home.js?v=4', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']
const APP_PATHS = ['/todo/', '/flashcards/', '/geography/']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const path = new URL(event.request.url).pathname
  if (event.request.method !== 'GET' || APP_PATHS.some((prefix) => path.startsWith(prefix))) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        return response
      })
      .catch(() => caches.match(event.request).then((response) => response || (event.request.mode === 'navigate' ? caches.match('/') : Response.error()))),
  )
})
