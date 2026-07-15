# Financial Brain

A private, mobile-first personal financial **decision** system — not a budget tracker.
It answers three questions well: what's truly *safe to spend*, *can I afford this*, and
*am I moving toward financial freedom*.

> **Core principle: CODE DECIDES. AI EXPLAINS.**
> Every financial value is computed by a deterministic, unit-tested TypeScript engine.
> The AI only receives those computed values and explains them — it never calculates.

## Monorepo layout

```
apps/
  web/            Next.js 15 (App Router) PWA — UI + Server Actions + auth
packages/
  types/          @fb/types  — money/time primitives, enums, engine I/O contracts
  engine/         @fb/engine — pure deterministic engine + constants + tests
  data/           @fb/data   — the ONLY layer that talks to Supabase (Phase 2)
  ai/             @fb/ai     — the "AI EXPLAINS" layer (Phase 4)
supabase/
  migrations/     0001 schema · 0002 RLS, indexes, triggers
```

The engine is pure: no I/O, no `Date.now()`, no `Math.random()`. "Now" is always injected
as a `Clock`. This is what makes it deterministic and fully testable.

## Prerequisites

- Node.js ≥ 20 (repo pins 24 via `.nvmrc`)
- npm (workspaces; no pnpm needed)
- [Supabase CLI](https://supabase.com/docs/guides/cli) for local DB / migrations

## Setup

```bash
npm install
```

### 1. Supabase project (you must do this — it needs your account)

Create a project at [supabase.com](https://supabase.com), then either:

- **Cloud:** `supabase link --project-ref <ref>` then `supabase db push` to apply
  `supabase/migrations`, **or**
- **Local:** `supabase start` then `supabase db reset` to apply migrations to the local DB.

### 2. Environment variables

```bash
cp apps/web/.env.example apps/web/.env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API), and
`ANTHROPIC_API_KEY`. `SUPABASE_SERVICE_ROLE_KEY` is optional for MVP.

### 3. Run

```bash
npm run dev          # Next.js dev server at http://localhost:3000
```

## Scripts (run from repo root)

| Command | What it does |
|---|---|
| `npm run typecheck` | Typecheck every workspace |
| `npm test` | Run all workspace tests |
| `npm run test:engine` | Run the engine test suite |
| `npm run build` | Build the web app |
| `npm run format` | Prettier write |

Engine coverage gate (Phase 1 exit criterion): `npm run coverage --workspace @fb/engine`
enforces 100% branch coverage.

## Status

**Phase 0 complete** — foundations: monorepo, typed domain model, Supabase schema + RLS,
auth shell.

**Phase 1 complete** — the deterministic engine: nine functions, 107 tests, 100% branch
coverage, golden fixtures reproducing the spec's $183 / $629 examples.

**Phase 2 complete** — the data layer and onboarding:

- `@fb/data` normalization bridge (DB rows → `EngineInput`), unit-tested; repositories;
  `recalculateFinancials` → snapshot persistence.
- Server actions for all entity CRUD + quick balance update, each able to trigger recalc.
- The 7-step onboarding wizard (accounts → income → obligations → life costs →
  subscriptions → goals → freedom), autosaving each entry, resumable, ending in the
  analyzing → Truth flow. Home reads the live snapshot.

To try it end-to-end you must connect a Supabase project (see Setup) and apply the
migrations; the app then runs the real engine over data you enter.

**Phase 3 complete** — the daily product: Home dashboard, Safe-to-Spend detail, Ask
Before I Spend (with the GREEN/YELLOW/RED decision result), Priorities, Money
Allocation, Goals, read-only Paycheck Plan, and the mobile bottom nav.

**Phase 4 complete** — the AI Financial Brain (`@fb/ai`), strictly **AI EXPLAINS, CODE
DECIDES**:

- A context builder that hands Claude only whitelisted, already-computed, dollar-
  formatted engine outputs — never the raw database, never arithmetic to perform.
- A calm, non-shaming system prompt and a server-side `claude-opus-4-8` call
  (`ANTHROPIC_API_KEY` stays on the server).
- A Brain chat screen with suggested questions and persisted conversation history.

Set `ANTHROPIC_API_KEY` in `apps/web/.env.local` to enable it; without a key the Brain
tells you it isn't connected yet rather than erroring.

### Known notes

- Dev-tooling audit advisories (esbuild → vite → vitest chain) are **dev-only** and not in
  the production bundle. Clearing them means bumping vitest to v3 (a deliberate major bump,
  deferred).
- The Supabase project itself must be created by you; this repo ships the migrations and
  client wiring but cannot provision a hosted project.
