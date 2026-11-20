/* Kirenix Клиника: работа без интернета.
   Страница — сначала из сети (чтобы сразу получать новую версию), без сети или при медленной сети — из кэша.
   Данные пациентов сюда не попадают: они лежат в IndexedDB браузера. */
const CACHE = 'kx-klinika-1.7-7c4516b5e4';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('kx-klinika-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate'){
    const net = fetch(req, {cache: 'no-cache'});
    // копию снимаем сразу, пока ответ ещё не отдан странице
    const copy = net.then(res => (res.ok && res.type === 'basic') ? res.clone() : null, () => null);
    e.waitUntil(copy.then(c => c && caches.open(CACHE).then(cache => cache.put('./index.html', c))).catch(() => {}));
    e.respondWith(page(net));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req)));
});

async function page(net){
  const slow = new Promise(r => setTimeout(r, 4000, null));
  try {
    const res = await Promise.race([net, slow]);
    if (res && res.ok) return res;
  } catch (err) { /* нет сети */ }
  const cache = await caches.open(CACHE);
  const cached = (await cache.match('./index.html')) || (await cache.match('./'));
  return cached || net;
}
