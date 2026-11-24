/* Cho phép chơi offline. Khi sửa bất kỳ file nào, tăng VERSION để máy tải bản mới. */
var VERSION = 'anmang-10';
var FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/core.js',
  'js/clues.js',
  'js/storage.js',
  'js/ui.js',
  'data/puzzles.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Trả bản trong bộ nhớ đệm ngay (mở nhanh, chạy offline), đồng thời tải bản mới về cho lần mở sau.
// Nhờ vậy lỡ quên tăng VERSION thì máy vẫn nhận bản mới, chỉ chậm một lần mở.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(function () { return hit; });
      if (hit) { e.waitUntil(net); return hit; }
      return net;
    });
  }));
});
