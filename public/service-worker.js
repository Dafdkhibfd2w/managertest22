self.addEventListener('install', (event) => {
  const CACHE = 'app-v1';
  const filesToCache = [
    '/', '/index.html',
    '/css/styles.css',
    '/js/dashboard.js',
    // הוצא מפה כל קובץ שלא קיים בפועל או קבצי API דינמיים
  ];

  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of filesToCache) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('Skip cache:', url, err);
        }
      }
    })
  );
});
