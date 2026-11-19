// Oh My Scrap PWA 최소 Service Worker (Web Share Target 및 설치 지원용)
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 네트워크 요청은 캐시 오염이나 Firebase Auth 충돌을 방지하기 위해 그대로 통과
self.addEventListener("fetch", () => {});
