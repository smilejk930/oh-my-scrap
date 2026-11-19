// Oh My Scrap PWA Service Worker (Web Share Target 및 설치 지원용)
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 동일 출처 페이지 탐색(navigate) 요청만 안전하게 전달하고, Firebase 예약 경로(/__/) 및 외부 API는 건드리지 않음
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/__/")) return;
  event.respondWith(fetch(event.request));
});
