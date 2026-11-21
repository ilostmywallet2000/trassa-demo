/* Трасса HQ — работа без интернета: файлы приложения сохраняются на телефоне.
   Версию меняем при каждом обновлении, тогда телефон скачает новые файлы. */
const CACHE = 'trassa-hq-v32';
const CORE = ['./', './index.html', './hq.css?v=32', './core.js?v=32', './edge.js?v=32', './scanner.js?v=32', './ui.js?v=32', './disp.js?v=32', './driver.js?v=32', './mech.js?v=32', './main.js?v=32', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const url = new URL(r.url);
  const page = r.mode === 'navigate';
  // страница — сначала из сети (чтобы приходили обновления), без сети — из памяти
  if (page) { e.respondWith(fetch(r).then(res => { caches.open(CACHE).then(c => c.put('./index.html', res.clone())); return res; }).catch(() => caches.match('./index.html'))); return; }
  // остальное (скрипты, распознавание текста, шрифты) — из памяти, иначе скачать и запомнить
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })));
  }
});
