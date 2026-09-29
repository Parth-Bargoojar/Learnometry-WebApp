# Learnometry — Web App

The authenticated Learnometry application: onboarding, diagnostics, the assessment player, diagnosis reports, study plans, practice, retests, progress, credits, billing and settings.

The public marketing website is a **separate project** in `../web`. The two share brand tokens (keep `src/app/globals.css` in step with `../web/src/app/globals.css`) but nothing else, and deploy separately (e.g. `learnometry.in` and `app.learnometry.in`).

## Run

```bash
npm install
npm run dev        # http://localhost:3001 (the marketing site uses 3000)
npm run typecheck
npm run lint
npm run build
npm run audit        accessibility, performance budget and PWA checks (needs a production build)
```

Copy `.env.example` to `.env.local`. `NEXT_PUBLIC_MARKETING_URL` points links to policies, FAQ and contact at the website.

## Specification

Build from the documents in the project root, in this order of authority:

1. `CONTEXT.md` — canonical decisions (§0.1)
2. `Learnometry_WEB_APP_STRUCTURE_v1.md` — screens, routes, components, defaults (§1.9)
3. `Learnometry_DESIGN_SYSTEM_v1.md` — visual authority (§49 for app extensions)
4. `Learnometry_PRD_v1.md`, `Learnometry_TRD_v1.md`

## Layout

```text
src/
├── app/
│   ├── (app)/          sidebar + bottom-tab shell: dashboard, assess, practice, plan,
│   │                   progress, credits, billing, settings, notifications
│   ├── (focus)/        assessment player, no navigation
│   ├── (auth)/         login, signup
│   ├── (onboarding)/   onboarding/[step]
│   ├── layout.tsx      fonts, theme (set before paint), noindex
│   └── globals.css     Design System tokens + dark theme
├── components/         UI primitives (ui.tsx, dialog.tsx) and screen components
└── lib/
    ├── config.ts       plans, credit costs, thresholds (Web App Structure §1.9)
    ├── data.ts         sample data shaped like the CONTEXT §7 API responses
    ├── diagnosis.ts    deterministic scoring and evidence aggregation
    ├── format.ts, routes.ts, site.ts, theme-script.ts, types.ts
```

## Current state

Front end complete for build phases **A–L** on sample data (JEE Main, Physics, Class 11 Mechanics):
learner app, money (packs, plans, checkout, payment confirmation, credit gating), guardian flows
(both sign-up paths, `/consent/[token]`, guardian portal at `/guardian`), auth screens, and depth
(plan history, progress history, settings sub-pages, Help, notification popover).

The sample learner, Rohan, is 17, so the default story runs through guardian approvals. Sunita is
the guardian account (`/guardian`). Requests, consent, dismissed banners and read notifications are
kept by `lib/local-store.ts`, which stands in for the API and realtime channel.

The admin console (phase K, Shell F, desktop only) is at `/admin`: dashboard, learners, questions,
curriculum, AI & cost, payments (with the refund queue), security, feature flags and the audit log.
Sample operational data lives in `lib/admin-data.ts`, rules in `lib/admin.ts` (decisions K1–K16), and
admin changes are kept by `lib/local-store.ts` like the other shared state. `lib/admin-auth.ts` is the
server-side gate to replace with the Supabase role + 2FA check.

Useful previews: `/dashboard?state=new` (S0), `/dashboard?state=out` (S7), `/consent/preview` (OTP
`246810`), `/billing/confirm?item=plus&sim=failed|slow`, `/help?contact=billing`.

Rule: values that server pages read (flags, lists, config) live in `lib/`, never in a `"use client"`
module — only components cross that boundary.

Phase L (polish): the app is an installable PWA (`app/manifest.ts`, hand-written `public/sw.js`, `/offline`, install card on the dashboard, offline banner), push notifications are live in Settings › Notifications (permission asked only from a button; set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for real delivery), `?` opens the keyboard sheet, and `npm run audit` checks accessibility (axe, 44px touch targets, both themes), the performance budget and the offline/push/keyboard behaviour. Decisions: Web App Structure §8.21a (L1–L13); results: §14.1 and §15.1. The service worker only registers in production builds. Sign-out clears cached pages, the push subscription and the offline plan copy (`clearDeviceData` in `lib/pwa.ts`).

Not yet built: Supabase auth and data, Razorpay, the AI gateway, the admin and push APIs behind the console, and the manual launch checks in Web App Structure §14.1 (screen readers, real iPhone and Android).
