const CACHE = 'catatan-uang-v1';
const ASET = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASET))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Tampilkan dari cache dulu, lalu perbarui cache dari jaringan di belakang layar.
// Permintaan ke server (POST) tidak disentuh di sini.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const jaringan = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') {
            const salinan = res.clone();
            caches.open(CACHE).then((c) => c.put(req, salinan));
          }
          return res;
        })
        .catch(() => cached);
      return cached || jaringan;
    })
  );
});
