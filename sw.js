const CACHE = 'railboard-shell-v34';
const ASSETS = ['./', './index.html', './styles.css', './src/app.js', './src/api.js', './src/storage.js', './src/config.js', './src/provider.js', './src/led.js', './manifest.webmanifest', './icons/favicon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
ASSETS.push('./icons/wordmark.svg');
ASSETS.push('./src/detail.js', './src/tracking.js', './src/updates.js', './src/map.js');
self.addEventListener('message', event => {
  if(event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
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
