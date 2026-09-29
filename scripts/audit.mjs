/*
  Phase L audit — Web App Structure §14 (accessibility), §15 (performance), §9.8 (PWA).

    npm run build && npm run audit            all three
    npm run audit -- a11y | perf | pwa        one of them
    AUDIT_URL=http://localhost:3001 npm run audit    against a server that is already running

  Without AUDIT_URL it starts `next start` itself on :3101 and stops it afterwards.
  Exits 1 when anything fails, so it can gate CI. The full result goes to audit-report/.

  a11y  Crawls the app from a seed list and, for every page, in light and dark at 320px and
        1280px, runs axe-core (WCAG 2.2 AA + best practice) and checks: one h1, no horizontal
        scroll at 320px, and target size on interactive elements: 44px in touch layouts (320px), 24px (WCAG 2.5.8) with a fine pointer (1280px).
  perf  Under mobile CPU and network throttling: JS transferred, LCP, CLS and long-task time
        per page, against BUDGET below.
  pwa   Manifest and icons, service worker headers, the offline page and cached plan, offline
        banner, install and push states, keyboard sheet, and Enter and Backspace in practice.
*/
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

/** Decision L11. Measured on this build with 4x CPU slowdown and "Slow 4G" (1.6 Mbps, 150 ms). */
export const BUDGET = {
  jsKB: 210, // transferred (gzip) JavaScript per learner page; the React + Next runtime alone is ~165 KB
  jsKBAdmin: 230, // admin console is desktop-only (K)
  lcpMs: 2500, // TRD §12.1 asks for < 2 s on the dashboard; 2.5 s is the "good" line for every page
  cls: 0.1,
  longTaskMs: 400, // total time in tasks over 50 ms during load (TBT-style)
};

const SEEDS = [
  "/dashboard", "/dashboard?state=new", "/dashboard?state=out", "/assess", "/assess/diagnostic", "/practice", "/plan",
  "/progress", "/progress/history", "/progress/concepts", "/credits", "/credits/buy", "/billing", "/billing/plans",
  "/billing/confirm?item=plus", "/settings", "/settings/profile", "/settings/study", "/settings/notifications",
  "/settings/appearance", "/settings/ai", "/settings/privacy", "/settings/account", "/help", "/notifications",
  "/plan/history", "/login", "/signup", "/forgot-password", "/verify-email", "/reset-password", "/onboarding/about-you", "/onboarding/exam", "/onboarding/ready", "/onboarding/child",
  "/consent/preview", "/guardian", "/guardian/approvals", "/guardian/settings", "/admin", "/admin/learners",
  "/admin/questions", "/admin/curriculum", "/admin/ai", "/admin/payments", "/admin/security", "/admin/flags",
  "/admin/audit", "/offline", "/this-page-does-not-exist",
];
const MAX_PAGES = 90;
const MOBILE = { width: 320, height: 640, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const DESKTOP = { width: 1280, height: 800 };

const mode = process.argv[2] ?? "all";
const failures = [];
const report = { a11y: [], perf: [], pwa: [] };
const fail = (area, where, what) => {
  failures.push({ area, where, what });
  console.log(`  ✗ [${area}] ${where}: ${what}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

/* ---------- server ---------- */

async function startServer() {
  if (process.env.AUDIT_URL) return { base: process.env.AUDIT_URL, stop: () => {} };
  const port = 3101;
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { stdio: "ignore" });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/offline")).ok) return { base, stop: () => child.kill() };
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error("next start did not come up; run `npm run build` first");
}

const isAdmin = (path) => path.startsWith("/admin");

/* ---------- discovery ---------- */

async function discover(browser, base) {
  const seen = new Set();
  const queue = [...SEEDS];
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  const key = (u) => {
    const x = new URL(u, base);
    return x.pathname + x.search;
  };
  while (queue.length && seen.size < MAX_PAGES) {
    const path = queue.shift();
    if (seen.has(key(path))) continue;
    seen.add(key(path));
    try {
      await page.goto(base + path, { waitUntil: "domcontentloaded" });
      const links = await page.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href")));
      for (const l of links) {
        const k = key(l);
        // Learn every distinct route shape once; ids and query variants add nothing new.
        const shape = k.replace(/\/[a-z]+[-_][\w-]+/g, "/:id").split("?")[0];
        if (![...seen].some((s) => s.replace(/\/[a-z]+[-_][\w-]+/g, "/:id").split("?")[0] === shape) && !queue.includes(l)) queue.push(l);
      }
    } catch {}
  }
  await ctx.close();
  return [...seen];
}

/* ---------- a11y ---------- */

async function auditA11y(browser, base) {
  console.log("\nAccessibility (WCAG 2.2 AA)");
  const pages = await discover(browser, base);
  console.log(`  ${pages.length} pages found`);
  const combos = [];
  for (const theme of ["light", "dark"]) for (const [name, vp] of [["320px", MOBILE], ["1280px", DESKTOP]]) combos.push({ theme, name, vp });

  for (const { theme, name, vp } of combos) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.hasTouch, isMobile: vp.isMobile, deviceScaleFactor: vp.deviceScaleFactor ?? 1, colorScheme: theme });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("lm-theme", t);
      } catch {}
    }, theme);
    const page = await ctx.newPage();
    for (const path of pages) {
      if (isAdmin(path) && name === "320px") continue; // desktop only (K)
      const where = `${path} · ${theme} · ${name}`;
      try {
        await page.goto(base + path, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        await page.addScriptTag({ content: axeSource });
        const res = await page.evaluate(async () =>
          axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } }),
        );
        for (const v of res.violations) {
          const nodes = v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ");
          report.a11y.push({ where, rule: v.id, impact: v.impact, nodes: v.nodes.length, sample: nodes });
          fail("a11y", where, `${v.id} (${v.impact}, ${v.nodes.length}×) ${nodes}`);
        }
        const dom = await page.evaluate(
          ({ mobile, min }) => {
            const visible = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
            const out = { h1: [...document.querySelectorAll("h1")].filter(visible).length, overflow: false, small: [] };
            out.overflow = mobile && document.documentElement.scrollWidth > window.innerWidth + 1;
            const sel = "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=radio], [role=tab], [role=checkbox]";
            for (const el of document.querySelectorAll(sel)) {
              const cs = getComputedStyle(el);
              if (cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden],[inert]")) continue;
              if (el.disabled) continue; // disabled controls aren't targets
              if (el.matches(".sr-only, .sr-only *") || el.closest(".sr-only")) continue;
              if (el.tagName === "A" && cs.display === "inline") continue; // inline text links are exempt (WCAG 2.5.8)
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              if (el.tagName === "INPUT" && ["checkbox", "radio"].includes(el.type) && el.closest("label")) continue; // the label is the target
              if (Math.min(r.width, r.height) < min) out.small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
            }
            return out;
          },
          { mobile: vp.width <= 320, min: vp.width <= 320 ? 43.5 : 23.5 },
        );
        const is404 = path.startsWith("/this-page");
        if (!is404 && dom.h1 !== 1 && path !== "/offline") fail("a11y", where, `${dom.h1} h1 elements`);
        if (dom.overflow) fail("a11y", where, "horizontal scroll at 320px");
        if (name === "320px" || name === "1280px") for (const s of dom.small.slice(0, 6)) fail("a11y", where, `target too small (${name === "320px" ? "44" : "24"}px minimum): ${s}`);
        report.a11y.push({ where, h1: dom.h1, small: dom.small.length });
      } catch (e) {
        fail("a11y", where, `could not load: ${e.message.split("\n")[0]}`);
      }
    }
    await ctx.close();
  }
}

/* ---------- perf ---------- */

async function auditPerf(browser, base) {
  console.log("\nPerformance budget (4x CPU, Slow 4G, 360px)");
  const pages = ["/dashboard", "/assess", "/assess/diagnostic", "/practice", "/plan", "/progress", "/credits", "/billing", "/settings/notifications", "/login", "/admin", "/offline"];
  // Worker blocked: this measures a first, cold visit, not the cache the worker builds afterwards.
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: "block" });
  for (const path of pages) {
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    const js = new Map();
    cdp.on("Network.responseReceived", (e) => {
      if (e.type === "Script") js.set(e.requestId, 0);
    });
    cdp.on("Network.loadingFinished", (e) => {
      if (js.has(e.requestId)) js.set(e.requestId, e.encodedDataLength);
    });
    await page.addInitScript(() => {
      window.__m = { lcp: 0, cls: 0, long: 0 };
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__m.lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__m.cls += e.value))).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__m.long += Math.max(0, e.duration - 50)))).observe({ type: "longtask", buffered: true });
    });
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => window.__m);
    const kb = Math.round([...js.values()].reduce((a, b) => a + b, 0) / 1024);
    const budgetKB = isAdmin(path) ? BUDGET.jsKBAdmin : BUDGET.jsKB;
    const row = { path, jsKB: kb, lcpMs: Math.round(m.lcp), cls: +m.cls.toFixed(3), longTaskMs: Math.round(m.long) };
    report.perf.push(row);
    console.log(`  ${path.padEnd(28)} JS ${String(kb).padStart(4)} KB · LCP ${String(row.lcpMs).padStart(5)} ms · CLS ${row.cls} · long tasks ${row.longTaskMs} ms`);
    if (kb > budgetKB) fail("perf", path, `JS ${kb} KB over the ${budgetKB} KB budget`);
    if (row.lcpMs > BUDGET.lcpMs) fail("perf", path, `LCP ${row.lcpMs} ms over ${BUDGET.lcpMs} ms`);
    if (row.cls > BUDGET.cls) fail("perf", path, `CLS ${row.cls} over ${BUDGET.cls}`);
    if (row.longTaskMs > BUDGET.longTaskMs) fail("perf", path, `long tasks ${row.longTaskMs} ms over ${BUDGET.longTaskMs} ms`);
    await page.close();
  }
  await ctx.close();
}

/* ---------- pwa ---------- */

async function auditPwa(browser, base) {
  console.log("\nPWA, offline, push, keyboard");
  const check = (cond, where, what) => (cond ? ok(`${where}: ${what}`) : fail("pwa", where, what));

  // Manifest and icons
  const manifest = await (await fetch(base + "/manifest.webmanifest")).json();
  check(manifest.start_url === "/dashboard" && manifest.display === "standalone", "manifest", "start_url /dashboard, display standalone");
  for (const icon of manifest.icons) {
    const r = await fetch(base + icon.src);
    check(r.ok && r.headers.get("content-type")?.includes("image/png"), "manifest", `icon ${icon.src} (${icon.sizes}, ${icon.purpose}) is served`);
  }
  check(manifest.icons.some((i) => i.purpose === "maskable") && manifest.icons.some((i) => i.sizes === "192x192") && manifest.icons.some((i) => i.sizes === "512x512"), "manifest", "192, 512 and maskable icons present");
  const sw = await fetch(base + "/sw.js");
  check(sw.ok && sw.headers.get("cache-control")?.includes("no-cache") && sw.headers.get("service-worker-allowed") === "/", "sw.js", "served with no-cache and scope /");

  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true, permissions: ["notifications"], serviceWorkers: "allow" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Worker installs and caches the offline page and its assets
  await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1500);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const shell = await (await caches.open(names.find((n) => n.startsWith("lm-shell")))).keys();
    const stat = await (await caches.open(names.find((n) => n.startsWith("lm-static")))).keys();
    return { shell: shell.map((r) => new URL(r.url).pathname), assets: stat.length };
  });
  check(cached.shell.includes("/offline") && cached.shell.includes("/mascot.jpeg"), "worker", `shell cached (${cached.shell.length} files) incl. /offline`);
  check(cached.assets > 5, "worker", `${cached.assets} static assets cached for the offline page`);

  // Visit pages online so they're stored, then go offline
  for (const p of ["/dashboard", "/plan"]) await page.goto(base + p, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" }); // under worker control from here
  await ctx.setOffline(true);

  await page.goto(base + "/dashboard").catch(() => {});
  check(await page.getByRole("heading", { level: 1, name: "Home" }).isVisible().catch(() => false), "offline", "/dashboard still loads from the cache");
  check(await page.getByText("You're offline.", { exact: false }).first().isVisible().catch(() => false), "offline", "offline banner shows");

  await page.goto(base + "/billing").catch(() => {});
  check(await page.getByRole("heading", { level: 1, name: "You're offline" }).isVisible().catch(() => false), "offline", "an uncached screen shows the offline page");
  check(await page.getByText("Your plan for today is still here.").isVisible().catch(() => false), "offline", "…with today's plan from this device");
  const tasks = await page.locator("#offline-plan ~ ul li, section[aria-labelledby=offline-plan] li").count();
  check(tasks > 0, "offline", `…listing ${tasks} tasks`);
  const styled = await page.evaluate(() => getComputedStyle(document.querySelector("main")).display);
  check(styled === "flex", "offline", "offline page is styled (CSS cached)");
  await ctx.setOffline(false);
  await page.waitForTimeout(500);

  // Sign-out clears cached pages
  await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    reg.active.postMessage({ type: "clear-user-data" });
  });
  await page.waitForTimeout(500);
  const pagesLeft = await page.evaluate(async () => (await caches.keys()).filter((n) => n.startsWith("lm-pages")).length);
  check(pagesLeft === 0, "sign-out", "cached pages are deleted on sign-out");

  // Install card: never before a diagnosis; once after; gone after Not now. Chromium needs its own event, so fake it.
  await page.goto(base + "/dashboard?state=new", { waitUntil: "networkidle" });
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed" }) })));
  await page.waitForTimeout(200);
  check((await page.getByRole("heading", { name: "Add Learnometry to your home screen" }).count()) === 0, "install", "not offered on a first visit (no diagnosis yet)");
  await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed" }) })));
  check(await page.getByRole("heading", { name: "Add Learnometry to your home screen" }).isVisible(), "install", "offered after a first diagnosis");
  await page.getByRole("button", { name: "Not now" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed" }) })));
  check((await page.getByRole("heading", { name: "Add Learnometry to your home screen" }).count()) === 0, "install", "never offered again after Not now");

  // Keyboard sheet
  await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
  await page.keyboard.press("?");
  check(await page.getByRole("dialog", { name: "Keyboard shortcuts" }).isVisible(), "keyboard", "? opens the shortcut sheet");
  await page.keyboard.press("Escape");
  check(!(await page.getByRole("dialog", { name: "Keyboard shortcuts" }).isVisible()), "keyboard", "Esc closes it");

  // Push: not installed → guidance; installed (emulated standalone) → turn on, test
  await page.goto(base + "/settings/notifications", { waitUntil: "networkidle" });
  check(await page.getByText("Push works once you install Learnometry").isVisible(), "push", "browser tab: explains install is needed");
  // Chromium can't emulate display-mode, so present the page as installed.
  await ctx.addInitScript(() => {
    const mm = window.matchMedia.bind(window);
    const noop = () => {};
    window.matchMedia = (q) =>
      q.includes("display-mode: standalone")
        ? { matches: true, media: q, onchange: null, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop, dispatchEvent: () => false }
        : mm(q);
  });
  await page.reload({ waitUntil: "networkidle" });
  const turnOn = page.getByRole("button", { name: "Turn on push notifications" });
  check(await turnOn.isVisible(), "push", "installed: offers Turn on push notifications");
  await turnOn.click();
  check(await page.getByText("Push is on for this device.").first().waitFor({ timeout: 5000 }).then(() => true, () => false), "push", "turning on works after the permission is granted");
  await page.getByRole("button", { name: "Send a test" }).click();
  await page.waitForTimeout(800);
  const shown = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).length);
  check(shown > 0, "push", "a test notification is shown through the service worker");
  const backLink = await page.evaluate(() => getComputedStyle(document.querySelector("header a[href='/settings']") ?? document.body).display);
  check(backLink !== "none", "standalone", "Back link stays visible in the installed app");

  // Practice: Enter and C
  await page.goto(base + "/practice", { waitUntil: "networkidle" });
  const href = await page.$$eval("a[href^='/attempt/']", (as) => as.map((a) => a.getAttribute("href"))).then((l) => l[0]);
  if (href) {
    await page.goto(base + href, { waitUntil: "networkidle" });
    await page.keyboard.press("a");
    check((await page.locator("[role=radio][aria-checked=true]").count()) === 1, "keyboard", "A selects an option");
    await page.keyboard.press("c");
    check((await page.locator("[role=radio][aria-checked=true]").count()) === 1, "keyboard", "C selects option C (it is not the clear key)");
    await page.keyboard.press("Backspace");
    check((await page.locator("[role=radio][aria-checked=true]").count()) === 0, "keyboard", "Backspace clears the answer");
    await page.keyboard.press("a");
    await page.keyboard.press("Enter");
    check(await page.getByText(/Correct|Not quite/).first().isVisible().catch(() => false), "keyboard", "Enter checks the answer in practice");
  } else fail("pwa", "keyboard", "no practice attempt link found on /practice");

  check(errors.length === 0, "runtime", errors.length ? `page errors: ${errors.slice(0, 2).join(" | ")}` : "no uncaught page errors");
  await ctx.close();
}

/* ---------- main ---------- */

const server = await startServer();
// New headless mode: the default headless shell reports notification permission as denied.
const browser = await chromium.launch({ channel: "chromium" }).catch(() => chromium.launch());
try {
  if (mode === "all" || mode === "a11y") await auditA11y(browser, server.base);
  if (mode === "all" || mode === "perf") await auditPerf(browser, server.base);
  if (mode === "all" || mode === "pwa") await auditPwa(browser, server.base);
} finally {
  await browser.close();
  server.stop();
}
mkdirSync("audit-report", { recursive: true });
writeFileSync("audit-report/latest.json", JSON.stringify({ at: new Date().toISOString(), budget: BUDGET, failures, ...report }, null, 2));
console.log(`\n${failures.length ? `${failures.length} failure(s)` : "All checks passed"}. Report: audit-report/latest.json`);
process.exit(failures.length ? 1 : 0);
