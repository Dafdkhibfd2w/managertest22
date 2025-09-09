// const CACHE = 'newdeli-v1';
// const ASSETS = ['/', '/css/style.css', '/api/invoices-page', '/api/dispersals-page', '/api/manage', '/api/create', '/api/admin'];

// self.addEventListener('install', (e) => {
//   e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
// });
// self.addEventListener('activate', (e) => {
//   e.waitUntil(caches.keys().then(keys =>
//     Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
//   ));
// });
// self.addEventListener('fetch', (e) => {
//   e.respondWith(
//     caches.match(e.request).then(cached => cached || fetch(e.request))
//   );
// });
