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

**Phase 0 complete.** Foundations in place: monorepo, typed domain model, engine skeleton
with the locked constants, pure/tested date & money primitives, full Supabase schema with
RLS on all 25 tables, and a working Next.js + Supabase auth shell.

**Phase 1 (next):** implement the nine engine functions behind a full test suite (golden
fixtures, table-driven scoring, property-based invariants) before any product UI.

### Known notes

- Dev-tooling audit advisories (esbuild → vite → vitest chain) are **dev-only** and not in
  the production bundle. Clearing them means bumping vitest to v3 (a deliberate major bump,
  deferred).
- The Supabase project itself must be created by you; this repo ships the migrations and
  client wiring but cannot provision a hosted project.
