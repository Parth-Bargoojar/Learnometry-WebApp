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

Front end complete for build phases **A–I** on sample data (JEE Main, Physics, Class 11 Mechanics):
learner app, money (packs, plans, checkout, payment confirmation, credit gating), guardian flows
(both sign-up paths, `/consent/[token]`, guardian portal at `/guardian`), and the auth screens.

The sample learner, Rohan, is 17, so the default story runs through guardian approvals. Sunita is
the guardian account (`/guardian`). Requests and consent made in one tab show up in the other through
`lib/local-store.ts`, which stands in for the API and realtime channel.

Useful previews: `/dashboard?state=new` (S0), `/dashboard?state=out` (S7), `/consent/preview` (OTP
`246810`), `/billing/confirm?item=plus&sim=failed|slow`.

Not yet built: Supabase auth and data, Razorpay, the AI gateway, phase J (plan/progress history,
settings sub-routes, help), the admin console (K) and the PWA (L).
