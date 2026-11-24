/* Service worker: deixa o app disponível offline.
 * Ao alterar qualquer arquivo do app, aumente a versão abaixo
 * para que os usuários recebam a atualização. */
const VERSION = 'v3';
const CACHE = `tarefas-${VERSION}`;
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('tarefas-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Lembrete enviado pelo servidor (/api/cron).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: event.data && event.data.text() }; }
  const title = data.title || 'Lembrete';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body ? `Lista: ${data.body}` : 'Lembrete da sua lista de tarefas',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: './' },
  }));
});

// Toque na notificação: volta para o app (ou abre, se estiver fechado).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all.find((c) => c.url.startsWith(self.registration.scope));
    if (client) return client.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // API sempre pela rede, nunca do cache

  // Navegação: entrega o app do cache (funciona offline), qualquer que seja a query string.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('index.html', { cacheName: CACHE });
      if (cached) return cached;
      return fetch(request);
    })());
    return;
  }

  // Demais arquivos: cache primeiro, rede como alternativa (e guarda no cache).
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true, cacheName: CACHE });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  })());
});
