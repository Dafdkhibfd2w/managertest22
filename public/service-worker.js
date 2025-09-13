const C = 'shiftpro-v1';
const ASSETS = [
  '/', '/index.html','/manage.html','/admin.html',
  '/css/base.css','/css/components.css','/css/layouts.css',
  '/js/core.js','/js/dashboard.js','/js/manage.js','/js/admin.js',
  '/icons/icon-192.png','/icons/icon-512.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(C).then(c=> c.addAll(ASSETS)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=> Promise.all(keys.filter(k=>k!==C).map(k=> caches.delete(k)))));
});
self.addEventListener('fetch', e=>{
  const {request} = e;
  e.respondWith(
    caches.match(request).then(cached=> cached || fetch(request).then(res=>{
      const copy = res.clone();
      caches.open(C).then(c=> c.put(request, copy));
      return res;
    }).catch(()=> caches.match('/index.html')))
  );
});
