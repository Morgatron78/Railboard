const CACHE = 'railboard-shell-v9';
const ASSETS = ['./', './index.html', './styles.css', './src/app.js', './src/api.js', './src/storage.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('railboard-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // Only cache the explicitly versioned application shell; never API responses.
  const key = event.request.mode === 'navigate' ? new URL('./', self.registration.scope).href : url.href;
  if (!ASSETS.some(asset => new URL(asset, self.registration.scope).href === key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(event.request)));
});
