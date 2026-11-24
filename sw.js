// IMPORTANT: Change 'eltra-v2' to 'eltra-v3', 'eltra-v4', etc., EVERY time you push a major update!
const CACHE_NAME = 'eltra-v2'; 

const ASSETS = [
  '/',
  './index.html',
  './style.css',
  './app.js',
  './scanner.js',
  './qr-generator.js',
  'https://unpkg.com/html5-qrcode'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting(); // Forces the new Service Worker to take over immediately
});

// THIS IS THE MISSING PIECE THAT DELETES OLD CACHES
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('Deleting old cache:', key);
          return caches.delete(key); 
        }
      }));
    })
  );
  self.clients.claim(); // Takes control of all open tabs immediately
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});