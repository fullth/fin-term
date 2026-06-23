// fin-term PWA Service Worker — 앱 셸 캐싱(설치형 요건).
// API(/api)·스트림(SSE)은 절대 캐싱하지 않고 네트워크로 통과시킨다(실시간 시세).
const CACHE = 'fin-term-shell-v1';
const SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API·SSE·교차출처는 캐싱 우회 (실시간 데이터)
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) return;
  // 네비게이션은 네트워크 우선, 실패 시 캐시된 index(오프라인 셸)
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
    return;
  }
  // 정적 자산은 캐시 우선
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
