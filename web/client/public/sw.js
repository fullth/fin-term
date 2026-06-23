// fin-term PWA Service Worker — 네트워크 우선(network-first).
// 실시간 데이터 앱이라 항상 최신 코드를 받아야 한다. 캐시는 오프라인 폴백 용도로만.
// API(/api)·SSE·교차출처는 절대 손대지 않고 네트워크로 통과.
const CACHE = 'fin-term-shell-v2';

self.addEventListener('install', () => {
  self.skipWaiting(); // 새 SW 즉시 활성화
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API·SSE·교차출처·GET 아님 → 캐싱 관여 안 함 (실시간 데이터)
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.origin !== self.location.origin) return;

  // 네트워크 우선: 항상 최신을 받고, 받은 응답을 캐시에 갱신. 오프라인이면 캐시 폴백.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/index.html'))),
  );
});
