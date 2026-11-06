// 긴급 도움 페이지 오프라인 보기 (D-028, 참고: Daisy)
// - 저장하는 것: 긴급 도움 페이지(help/)와 그 페이지가 쓰는 화면 파일(/_astro/의 CSS·JS)만.
// - 다른 페이지는 손대지 않음(네트워크 그대로). 어떤 요청도 외부로 보내지 않음.
// - 앱 설치(manifest)는 두지 않음 — 휴대전화에 아이콘이 남지 않게.
const CACHE = 'bs-help-v2'; // 바뀌면 예전 저장본(옛 글꼴 등)을 지움
const SCOPE = new URL(self.registration.scope);
const HELP = new URL('help/', SCOPE).pathname;
const ASSETS = new URL('_astro/', SCOPE).pathname;

// 긴급 도움 HTML을 받아 저장하고, 안에서 쓰는 /_astro/ 파일도 함께 저장
async function saveHelp(res) {
  const cache = await caches.open(CACHE);
  await cache.put(HELP, res.clone());
  const html = await res.text();
  const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((m) => new URL(m[1], SCOPE))
    .filter((u) => u.origin === SCOPE.origin && u.pathname.startsWith(ASSETS));
  await Promise.all(urls.map((u) => cache.add(u.pathname).catch(() => {})));
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(fetch(HELP, { cache: 'no-cache' }).then((r) => (r.ok ? saveHelp(r) : null)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin) return;

  // 긴급 도움: 인터넷이 되면 늘 최신을 받아 저장, 안 되면 저장본
  if (req.mode === 'navigate' && (url.pathname === HELP || url.pathname === HELP.replace(/\/$/, ''))) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) e.waitUntil(saveHelp(res.clone()));
        return res;
      } catch {
        return (await caches.match(HELP)) || Response.error();
      }
    })());
    return;
  }

  // 화면 파일: 저장본이 있으면 그것을(파일 이름에 버전이 들어 있어 바뀌지 않음), 없으면 네트워크.
  // 긴급 도움 페이지가 불러온 파일(스크립트가 이어서 부르는 조각 포함)이면 함께 저장.
  if (url.pathname.startsWith(ASSETS)) {
    e.respondWith((async () => {
      const hit = await caches.match(url.pathname);
      if (hit) return hit;
      const res = await fetch(req);
      const client = e.clientId ? await self.clients.get(e.clientId) : null;
      if (res.ok && client && new URL(client.url).pathname === HELP) {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE).then((c) => c.put(url.pathname, copy)));
      }
      return res;
    })());
  }
});
