# Vendra — Procurement & Vendor Operations Console

A multi-company procurement workflow system: purchase requests move through
division approval, finance approval (with a two-approver rule above a
threshold), and purchase order issuance, with full audit trail, role-based
access, and company/division-scoped data visibility.

Built as a single Next.js 16 (App Router) application — Server Components and
Server Actions for both the UI and the backend, Postgres via Drizzle ORM,
cookie-based sessions. No separate API server, so it deploys to Vercel as one
project.

## Live demo

**App:** https://vendra-aksharma127s-projects.vercel.app/login
**Repo:** https://github.com/Aksharma127/vendra

## Demo accounts

Seeded with two companies (KIG Manufacturing, KIG Trading Co.), four
divisions, four vendors, and six users. Password for all: `vendra123`.

| Email | Role | Notes |
|---|---|---|
| priya@vendra.demo | Employee | Raises requests |
| rahul@vendra.demo | Division Manager | Approves at division level (Plant Ops, KIG Manufacturing) |
| meera@vendra.demo | Finance Approver | Approves at finance level |
| arjun@vendra.demo | Procurement Officer | Issues purchase orders |
| zara@vendra.demo | Auditor | Read-only, audit trail + reports |
| admin@vendra.demo | Admin | Structural admin only — no visibility into requests, orders, or spend (by design) |

**Demo history (`npm run db:seed:demo`):** adds seven more colleagues
(kabir, ananya, vikram, sana, dev, ishaan, nisha `@vendra.demo`, same
password), five more vendors, and ~400 purchase requests / ~300 purchase
orders spread over the last six months across all four divisions. Every
request is walked through the real workflow (division → finance → PO →
delivered → closed, with rejections, returns and withdrawals), so the audit
trail, numbering and dashboard charts are all consistent. Idempotent; pass
`-- --reset` to regenerate it relative to today (e.g. right before a demo).

The history is dated relative to the day it was seeded, so a week later
"Ordered this month" reads ₹0. `npm run db:seed:demo -- --roll-forward`
shifts only the generated rows forward by whole days so the newest event is
today again. Real data is never touched, and a second run on the same day does
nothing. Add a file path (`-- --roll-forward refresh.sql`) to get the same
thing as SQL to paste into a hosted SQL editor instead.

**Pre-seeded data:** the database already has purchase requests sitting at
every stage of the workflow — a draft, one awaiting division approval, one
awaiting finance approval, one approved and awaiting a PO, one with an
issued PO, one fully closed (PO delivered and closed), and one rejected —
plus the two resulting purchase orders. Log in as any persona above and
the dashboard, Approval Queue, and Purchase Orders pages already have
real data to look at; no setup needed to see the app "used."

**Demo walkthrough (to see the workflow run end to end):** log in as Priya,
raise a request (keep it under ₹5,00,000 total to avoid the two-approver
finance rule, and add a justification if the amount is over ₹50,000) →
sign out, log in as Rahul, approve it in the Approval Queue → sign out,
log in as Meera, approve it → sign out, log in as Arjun, issue a purchase
order against it → check the Audit Trail as Zara.

## Local setup

Requires Node 20+ and a Postgres 16 database.

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL
npm run db:setup       # push schema, apply constraints, seed demo data
npm run db:seed:demo   # optional: six months of realistic procurement history
npm run dev
```

## AI autofill (optional)

On **New Purchase Request**, "Fill with AI" takes a plain-language note
("need 40 safety shoes ~1800 each"), a pasted supplier email, or a photo/PDF
of a quote, and fills in category, item, quantity, unit cost and
justification using Google Gemini. It only pre-fills the form: the
requester reviews it (AI-filled fields are tinted, with the model's notes
and confidence shown) and nothing is saved until they press Save, which goes
through the normal server-side validation.

- Set `GEMINI_API_KEY` (free key from https://aistudio.google.com/apikey).
  Without it the AI panel simply doesn't render.
- `GEMINI_MODEL` optionally overrides the model; if the configured name isn't
  available to the key it falls back to `gemini-2.5-flash`.
- Endpoint: `POST /api/ai/draft` (Route Handler, not a Server Action, to
  allow uploads up to 4 MB). Requires a signed-in user with `pr:create`,
  accepts JPG/PNG/WebP/HEIC/PDF, and has a per-user rate limit.

## Deploying to Vercel

### 1. Get a production Postgres database

Vercel doesn't run Postgres itself. Use any managed Postgres — this was
built and tested against plain `postgres`/Drizzle, so any of these work
with no code changes:

- **Neon** (neon.tech) — free tier, native Vercel integration
- **Supabase** (supabase.com) — free tier
- **Vercel Postgres** (via the Storage tab in your Vercel project)

Copy the connection string. It must end in `?sslmode=require` (Neon and
Supabase both give you this by default).

### 2. Push the schema and seed data

From your local machine, pointed at the **production** database:

```bash
DATABASE_URL="postgresql://...sslmode=require" npm run db:setup
DATABASE_URL="postgresql://...sslmode=require" npm run db:seed:demo
```

This runs, in order: `drizzle-kit push` (creates all tables/enums), the
manual-constraints script (`drizzle/manual-constraints.sql` — composite
foreign keys and the NULLS-NOT-DISTINCT index that Drizzle Kit's push
doesn't express; see that file for why they matter), and the seed script
(demo companies/divisions/users/vendors).

### 3. Deploy

```bash
npm install -g vercel   # if you don't have it
vercel
```

Follow the prompts (link or create a project). When asked for environment
variables, or afterward in the Vercel dashboard under **Settings →
Environment Variables**, set:

- `DATABASE_URL` — the same production connection string from step 1
- `SESSION_SECRET` — any long random string
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` — output of `openssl rand -base64 32`;
  stabilizes Server Action reference encryption across serverless instances
  (recommended by Next.js for this deployment shape, not required to run)

Then either `vercel --prod`, or push to the branch Vercel is tracking (if
you connect the project to a GitHub repo, every push to `main` deploys
automatically).

No other configuration is needed — no build command overrides, no
serverless function config. `next build` / `next start` (which Vercel runs
automatically) are all this project needs.

**Deployment Protection:** Vercel gates new projects behind an SSO wall by
default, so anyone without access to your Vercel account gets redirected to
a login page instead of the app. Before sharing the link, go to the
project's **Settings → Deployment Protection** and turn it off (or scope it
to preview deployments only) — then open the link in an incognito window to
confirm it actually loads for someone who isn't you.

### 4. Re-running the seed later

The seed script is idempotent (`onConflictDoNothing` on every insert), so
`npm run db:seed` (pointed at production) can be re-run safely — it won't
duplicate demo data, but it also won't reset anything you've changed through
the app.

## What was deliberately scoped down

This was built end-to-end in one session against a hard deadline. A few
things from the original design spec were deliberately cut or simplified
rather than left half-built — each one is a documented, load-bearing
decision, not an oversight:

- **Static role → capability map** instead of a fully dynamic per-menu
  permission-matrix admin UI. Every capability check still happens
  server-side, on every request (`src/lib/rbac.ts`, `src/lib/auth-context.ts`)
  — what's cut is only the *admin UI for editing* which role has which
  capability, not the enforcement itself.
- **Admin has zero business-data visibility** by design: the Admin role
  sees only structural counts (companies/divisions/users) on the dashboard,
  never requests, orders, or spend. This is enforced in
  `src/app/(app)/dashboard/page.tsx` via `ctx.hasBusinessRole`.
- **No separate Express/API-server split** — the original architecture
  called for a separate backend; this was consolidated into Next.js Server
  Actions and Route Handlers so the whole thing is one Vercel deployment.
- **Session auth is a plain DB-backed cookie**, not a JWT or a library like
  NextAuth — simpler to reason about and just as secure for this scope,
  since the session ID is an unguessable UUID and the cookie is
  `httpOnly`/`secure`/`sameSite=lax`.

## Architecture notes worth knowing before you demo this

- **Company/division scoping is re-derived on every request**
  (`getAuthContext()` in `src/lib/auth-context.ts`), never cached and never
  trusted from client input. A division's access grant is only honored if
  its *current* `company_id` still matches an authorized company — so
  deactivating or reparenting a division takes effect immediately.
- **Finance approval above the threshold requires two distinct approvers**,
  and the first-approver claim is a genuinely atomic
  `UPDATE ... WHERE finance_first_approver_id IS NULL` (not a same-value
  compare-and-swap), so two simultaneous approval clicks can't both become
  "the first approver" (`src/lib/workflow/purchase-requests.ts`).
- **PR/PO numbers are allocated atomically per company, per calendar year**
  (`src/lib/workflow/numbering.ts`), via an upsert — never `COUNT`/`MAX` —
  so numbers can't collide under concurrent submissions and reset to
  `00001` on a new year.
- **The database itself enforces cross-entity company matching** via
  composite foreign keys (a purchase order's vendor must share the PO's
  `company_id`; a PR's division must share the PR's `company_id`) — see
  `drizzle/manual-constraints.sql`. This is a backstop below the
  application-level checks, not a replacement for them.
