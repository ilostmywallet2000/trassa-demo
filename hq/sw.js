/* Трасса HQ — работа без интернета: файлы приложения сохраняются на телефоне.
   Версию меняем при каждом обновлении, тогда телефон скачает новые файлы. */
const CACHE = 'trassa-hq-v50';
const CORE = ['./', './index.html', './hq.css?v=50', './core.js?v=50', './edge.js?v=50', './scanner.js?v=50', './ui.js?v=50', './disp.js?v=50', './driver.js?v=50', './mech.js?v=50', './main.js?v=50', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const url = new URL(r.url);
  const page = r.mode === 'navigate';
  // страница — сначала из сети (чтобы приходили обновления), без сети — из памяти
  // cache: 'no-cache' — мимо 10-минутного кеша сайта, иначе обновление приходит не сразу
  if (page) { e.respondWith(fetch(r.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => { caches.open(CACHE).then(c => c.put('./index.html', res.clone())); return res; }).catch(() => caches.match('./index.html'))); return; }
  // остальное (скрипты, распознавание текста, шрифты) — из памяти, иначе скачать и запомнить
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })));
  }
});
