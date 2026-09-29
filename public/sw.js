/*
  Learnometry service worker — Web App Structure §9.8, decisions L2–L4, L8.

  Hand-written on purpose: the rules fit on one page, and a build plugin would add a
  dependency and a second cache layer to reason about.

    • App shell   — /offline, the logo, the mascot and every asset /offline needs are
                    cached at install, so the offline page is styled and readable.
    • Static      — /_next/static (hashed, so cache-first is safe), images and fonts.
    • Pages       — only /dashboard, /plan(/tasks/*) and /attempt/*, network-first, so a
                    learner offline still sees today's plan and can reload a test in
                    progress (the player keeps answers on the device).
    • Everything else goes to the network untouched. Data (/api) is never cached here, and
      no POST or other write is ever intercepted, so a payment or a submit cannot be
      replayed or served stale.

  Cached pages belong to a signed-in learner, so the page cache is deleted on sign-out
  (message "clear-user-data") and is capped in size.

  Push shows a notification for every push event (browsers require it) and only ever
  opens a same-origin path.
*/

const VERSION = "v1";
const SHELL = `lm-shell-${VERSION}`;
const STATIC = `lm-static-${VERSION}`;
const PAGES = `lm-pages-${VERSION}`;
const KEEP = [SHELL, STATIC, PAGES];

const OFFLINE = "/offline";
const PRECACHE = ["/logo-mark.png", "/primary-logo.png", "/primary-logo-dark.png", "/mascot.jpeg", "/icon-192.png", "/badge-96.png"];
const PAGE_ALLOW = [/^\/dashboard$/, /^\/plan(\/tasks\/[^/]+)?$/, /^\/attempt\/[^/]+$/];
const ASSET = /\.(?:png|jpe?g|webp|avif|svg|ico|woff2?)$/i;
const NETWORK_WAIT_MS = 4000;
const MAX_PAGES = 30;
const MAX_STATIC = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (!KEEP.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

async function precache() {
  const shell = await caches.open(SHELL);
  const assets = await caches.open(STATIC);

  // The offline page is the one thing that must work, so its failure fails the install.
  const offline = await fetch(OFFLINE, { cache: "reload" });
  if (!offline.ok) throw new Error("offline page unavailable");
  const html = await offline.clone().text();
  await shell.put(OFFLINE, offline);

  // Its scripts, styles and fonts are hashed, so read them out of the page itself.
  const found = new Set(html.match(/\/_next\/static\/[\w\-./%~]+/g) || []);
  for (const path of [...found]) {
    if (!path.endsWith(".css")) continue;
    try {
      const css = await (await fetch(path)).text();
      for (const m of css.match(/\/_next\/static\/[\w\-./%~]+/g) || []) found.add(m);
    } catch {}
  }
  await Promise.all(
    [...found].map((path) =>
      fetch(path)
        .then((res) => (res.ok ? assets.put(path, res) : undefined))
        .catch(() => undefined),
    ),
  );

  // Nice to have: a missing logo must not block installing the worker.
  await Promise.all(
    PRECACHE.map((path) =>
      fetch(path)
        .then((res) => (res.ok ? shell.put(path, res) : undefined))
        .catch(() => undefined),
    ),
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(navigate(req, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/_next/image" || ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  }
});

async function navigate(req, url) {
  const cacheable = PAGE_ALLOW.some((re) => re.test(url.pathname));
  const pages = await caches.open(PAGES);
  const stored = cacheable ? await pages.match(url.pathname) : undefined;
  try {
    // With a stored copy, don't make a learner on a bad connection wait for the network.
    const res = stored ? await Promise.race([fetch(req), wait(NETWORK_WAIT_MS)]) : await fetch(req);
    if (cacheable && res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) {
      await pages.put(url.pathname, res.clone());
      await trim(pages, MAX_PAGES);
    }
    return res;
  } catch {
    if (stored) return stored;
    const offline = await caches.match(OFFLINE, { cacheName: SHELL });
    return offline || Response.error();
  }
}

const wait = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), ms));

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = (await cache.match(req)) || (await caches.match(new URL(req.url).pathname, { cacheName: SHELL }));
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) {
      await cache.put(req, res.clone());
      await trim(cache, MAX_STATIC);
    }
    return res;
  } catch {
    return Response.error();
  }
}

// Cache.keys() is in insertion order, so dropping from the front removes the oldest.
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-user-data") event.waitUntil(caches.delete(PAGES));
});

/* ---------- Push (Web App Structure §8.17, §9.10) ---------- */

// Only same-origin paths; anything else falls back to the dashboard.
function safePath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(typeof data.title === "string" && data.title ? data.title : "Learnometry", {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { url: safePath(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin);
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) {
        if (new URL(client.url).origin !== target.origin) continue;
        try {
          await client.focus();
          await client.navigate(target.href);
          return;
        } catch {}
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
