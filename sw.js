/* Offline support for the Oun Clinic app. Bump VERSION when the app files change. */
const PREFIX = "oun-";
const VERSION = PREFIX + "v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./logo.webp", "./doctor.webp",
  "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png", "./news.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

/* Only remove this app's own old caches; other apps on the same site keep theirs. */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const old = keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION);
      await Promise.all(old.map((k) => caches.delete(k)));
      await self.clients.claim();
      /* After an update, reopen any open app window so it uses the new files. */
      if (old.length) (await self.clients.matchAll({ type: "window" })).forEach((c) => c.navigate(c.url).catch(() => {}));
    })
  );
});

function save(req, res) {
  if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* News: newest from the internet when online, saved copy when offline. */
  if (url.pathname.endsWith("/news.json")) {
    event.respondWith(fetch(req).then((res) => save(req, res)).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  /* Book pages and pictures: download once, then always from the phone (no repeat downloads). */
  if (/\.(bin|webp|png|jpg)$/.test(url.pathname)) {
    event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => save(req, res))));
    return;
  }
  /* App page: open instantly from the phone, refresh the saved copy in the background. */
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const fresh = fetch(req).then((res) => save(req, res)).catch(() => hit || caches.match("./index.html"));
      return hit || fresh;
    })
  );
});
