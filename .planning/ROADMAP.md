# ROADMAP

Revised 2026-09-18 after the human answered ARCH-1…ARCH-6. **Phase 1 was reshaped**, not edited:
ARCH-1 turned an additive migration into a rename, and ARCH-5 added a whole task.

Three phases, six plans, **eleven tasks**. **Phases 2 and 3 have no dependency on each other** and
are intended to run concurrently once Phase 1 has landed.

> Amended again 2026-09-18: ARCH-5 was revised to option **(b)** — full price confidentiality,
> including appointment price fields (D-21, REQ-020). `01-03` split into two sequential tasks as a
> result. `tsconfig.json` gained `allowImportingTsExtensions` and belongs to `01-02-T1` (DET-8).

---

## Phase 1 — Pricing foundation  ·  status: NOT STARTED

Schema, hand-written types, seeds, the pure money/resolution module with its tests, and the
employee rate lockdown. **No admin screen reads any of it when this phase closes**, so the phase
can be reviewed on its own.

- Requirements: REQ-001, REQ-002, REQ-003, REQ-006 (schema), REQ-007, REQ-008, REQ-009, REQ-010,
  REQ-011, REQ-017 (enumerate), REQ-018 (column), REQ-019, REQ-020, and the module halves of
  REQ-004 / REQ-005.
- Plans — **three, five tasks; four dispatchable immediately**:
  - `phases/01-pricing-foundation/01-01-PLAN.md` — migration A, `database.ts`, blast-radius check
    (T1); seeds (T2).
  - `phases/01-pricing-foundation/01-02-PLAN.md` — `src/lib/pricing/` + tests (T1). Owns
    `tsconfig.json`.
  - `phases/01-pricing-foundation/01-03-PLAN.md` — migration B, `jobs_employee_view` +
    `appointments_employee_view` + the `client_locations` policy repair (T1); re-pointing the three
    employee queries through them (T2). Required by ARCH-5 = (b); **T2 is the one genuine
    intra-phase dependency in this plan** — see below.
- **Gate — corrected 2026-09-18 (REQ-017, D-22, B-07):**
  `supabase db reset` applies both migrations; `npm run seed:admin` and `test-data.sql` run twice
  and are proven **by the row counts in REQ-010's acceptance, queried after each run — never by an
  exit code or a console line** (B-07: the seed script printed success and exited 0 over an empty
  database); `npm test` passes; `npm run lint` clean; **`npx tsc --noEmit` is CLEAN** — the rename
  produces no type error at all, because no Supabase client is parameterized with `Database`, so
  any error here is a real defect rather than expected ripple; **all three employee screens render
  in a browser for a seeded employee with the job-site address present**, and the REQ-020 PostgREST
  checks return zero rows on an *assigned* appointment's price columns;
  `pricing_backfill_check.sql` reports its section-3 invariants as 0 and its section-1/2 output is
  surfaced to the human.
  `npm run build` is **not** part of this gate (D-19); the full build bar returns at the Phase 2
  gate. A clean `tsc` at this point says nothing about whether the rename's call sites were swept —
  that evidence is REQ-004's grep and REQ-021's browser walk, both of which land in Phase 2.
- **Blocked on**: nothing. Four of the five tasks dispatch immediately; `01-03-T2` waits on
  `01-03-T1`'s applied migration and nothing else.

## Phase 2 — Pricing consumption  ·  status: NOT STARTED  ·  depends on Phase 1

Every site that read `price_override_cents ?? base_price_cents` switches to the resolver; the
invoice builder freezes lines and writes the appointment-side billed copy; the rename's ripple is
cleared and the tree builds again.

- Requirements: REQ-004 (adoption), REQ-005 (adoption), REQ-006 (code), REQ-012, REQ-013, REQ-014,
  REQ-017 (sweep), REQ-018 (write path), REQ-021 (browser walk).
- Plans:
  - `phases/02-pricing-consumption/02-01-PLAN.md` — jobs surface. 2 tasks, concurrent.
  - `phases/02-pricing-consumption/02-02-PLAN.md` — appointments + invoices. 2 tasks, concurrent.
  - The two plans share no writable file and run at the same time.
- Gate: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` — **all four clean, no
  exceptions**. This is where the constitution's §16 bar is restored. Plus each plan's smoke script.
  **Those four prove almost nothing about this milestone's actual risk** (REQ-017): the clients are
  untyped, so a surviving `base_price_cents` is a runtime 400, not a build error. The gate's real
  content is REQ-004's zero grep and **REQ-021's browser walk over all ten affected routes with
  zero `/rest/v1/` responses ≥ 400**.
- **Blocked on**: Phase 1 only.

## Phase 3 — Client-job pricing admin surface  ·  status: NOT STARTED  ·  depends on Phase 1

CRUD for `client_job_pricing` hung off the client detail page, mirroring client-locations CRUD.

- Requirements: REQ-015.
- Plan: `phases/03-client-job-pricing-admin/03-01-PLAN.md` — 3 tasks.
- **Does not depend on Phase 2.** Dispatch it in the same block.
- Gate: `npm run lint`, plus the CRUD smoke script. **Corrected 2026-09-18:** `npx tsc --noEmit` is
  clean throughout this milestone (REQ-017), so Phase 3's files must contribute no error *and* the
  whole run must stay clean — an error here is a defect, not Phase 2 ripple. `npm run build` is
  still checked at the Phase 2 gate. The pricing routes are new, so REQ-021 does not cover them;
  their proof is this plan's own browser smoke script.

---

## Dispatch graph

```
block 1                          block 2                                    block 3
──────────────────────────────────────────────────────────────────────────────────────
01-01-T1  coder-sr  migration A  ─┬──▶ 02-01-T1  coder-jr  jobs action/list/routes ─┐
          types, check script     │                                                 │
                                  ├──▶ 02-01-T2  designer  job-form                 │
01-01-T2  coder-jr  seeds ────────┤                                                 │
                                  ├──▶ 02-02-T1  coder-sr  appointments             ├──▶ verifier
01-02-T1  coder-sr  pricing ──────┤                                                 │   (whole
          module + tests          ├──▶ 02-02-T2  coder-sr  invoices                 │   milestone)
                                  │                                                 │
01-03-T1  coder-sr  migration ────┼──▶ 03-01-T1  coder-sr  pricing actions          │
          B (ARCH-5 = b)          ├──▶ 03-01-T2  designer  pricing components       │
                │                 ├──▶ 03-01-T3  coder-jr  pricing routes           │
                └─────────────────┴──▶ 01-03-T2  coder-sr  employee queries ────────┘
```

Four of the five block-1 tasks are dispatchable immediately — there are no unanswered questions
left. Block 2 is **eight-wide**: the seven Phase 2/3 tasks the moment block 1 lands, plus
`01-03-T2`, which needs only `01-03-T1`.

**`01-03-T2`'s dependency is real, and is named as an artifact**: it needs the *applied* migration B
— `jobs_employee_view` and `appointments_employee_view` existing in the local database with the
column lists `01-03-T1` reports. Its central decision (aliased view embed vs. multiple round-trips)
is empirical: it is answered by issuing the query against those views and reading PostgREST's
response, and it cannot be answered before they exist. This is not sequencing by habit — it is the
one place in this milestone where a task's *shape* is decided by a runtime discovery.

**Critical path**: `01-01-T1` → `02-02-T2` → verification. Two working blocks; that is the floor.
`01-01-T1` is on it because it produces `database.ts`, which every block-2 task type-checks against,
and `02-02-T2` is the largest block-2 task (invoices: the resolver adoption, the frozen lines, and
REQ-018's write path). `01-03-T1` → `01-03-T2` is a second chain of the same length, so ARCH-5 = (b)
**did not lengthen the critical path** — it widened block 2 instead.

**Deliberate widenings**, each backed by a written interface contract rather than an accident of
ordering:
- Block 1 was widened from 2 tasks to 4: the seeds were split out of the migration task (they touch
  no file it touches), and ARCH-5's lockdown was given its own migration rather than being folded
  into `01-01-T1`, whose owned set would then have spanned two unrelated concerns.
- **`01-03` was split on the migration↔queries seam** rather than kept as one task. That split is
  what lets the migration go out in block 1 while the risky, empirically-shaped query rewrite runs
  in block 2 beside everything else, instead of holding one `coder-sr` across both. It is also the
  honest boundary: the two halves are separated by a runtime discovery, not by taste.
- Block 2 is eight-wide: jobs UI split from the jobs action, pricing components and routes split
  from the pricing actions, appointments split from invoices, Phase 3 kept independent of Phase 2,
  and `01-03-T2` folded in alongside them.

### Intra-block type-check orderings — not dependencies

These are **verification-time** orderings. Every one of these tasks can be *written* immediately
against a frozen contract; only the final type-check needs its sibling's file to exist, and the
gate runs after the whole block lands. **Do not serialise on any of them.**

- `01-02-T1`'s `lookup.ts` type-checks against `01-01-T1`'s `database.ts`.
  (`01-02-PLAN.md`, concurrency note.)
- `01-01-T2`'s seeds run against `01-01-T1`'s migration and type-check against its `database.ts`.
  (`01-01-PLAN.md`, concurrency note.)
- `01-03-T1` creates `jobs_employee_view` and `appointments_employee_view`, whose **types**
  `01-01-T1` writes. Both column lists are frozen in `01-CONTEXT.md` "Cross-task type contract";
  neither task may edit the other's file, and neither waits on the other.

**`01-03-T1` → `01-03-T2` is NOT in this list.** It is a true dependency on an applied artifact, not
a type-check ordering, and it must be serialised. See the dispatch graph above.
- `03-01-T2` imports `03-01-T1`'s action exports, and `03-01-T3` imports both `03-01-T1`'s actions
  and `03-01-T2`'s components. Both build against the frozen signatures at the top of
  `03-01-PLAN.md`. *(This note closes plan-check gap 5: `ROADMAP.md` previously drew these three as
  mutually independent with no caveat, which risked being read as a true zero-dependency split.)*

### Owned-file union — re-checked 2026-09-18 after `01-03` widened and split

**Result: zero collisions, in both blocks.** Every path below appears exactly once across all eleven
tasks, and no two tasks eligible to run in the same block share a writable file. Specifically
re-verified after ARCH-5 = (b):

- `01-03-T1`'s writable set **shrank to a single new migration file** and no longer contains any
  TypeScript, so its widened scope (a second view, a second dropped policy, the `client_locations`
  policy repair) added **no** file to the union at all.
- `01-03-T2` holds the three `(employee)/` route files that `01-03-T1` used to. **No Block-2 task
  owns anything under `(employee)/`** — Phase 2 and Phase 3 are confined to `(admin)/`,
  `src/components/admin/`, `src/lib/actions/` and `src/lib/pricing/` — so folding `01-03-T2` into
  block 2 introduced no contention.
- `src/types/database.ts` remains `01-01-T1`-only; `01-03-T1` is explicitly forbidden from touching
  it and instead hands over both view column lists through the frozen contract in `01-CONTEXT.md`.
- `tsconfig.json` is `01-02-T1`-only (DET-8). Nothing else in any phase reads or writes it.
- The two migration files carry distinct timestamps (`...120000_` and `...130000_`) and distinct
  concerns, so neither task can be tempted into the other's file.

The union also covers every one of the 56 `base_price_cents` call sites (`01-RESEARCH.md §10`).

```
BLOCK 1
01-01-T1  supabase/migrations/20260918120000_hourly_pricing_and_client_job_pricing.sql
          supabase/checks/pricing_backfill_check.sql
          src/types/database.ts
01-01-T2  supabase/test-data.sql
          scripts/seed-admin-users.ts
01-02-T1  src/lib/pricing/money.ts
          src/lib/pricing/resolve.ts
          src/lib/pricing/lookup.ts
          tests/pricing/money.test.ts
          tests/pricing/resolve.test.ts
          package.json
          tsconfig.json                      <- adds "allowImportingTsExtensions" (DET-8)
01-03-T1  supabase/migrations/20260918130000_restrict_employee_price_visibility.sql
                                             <- entire writable set; no TypeScript at all

BLOCK 2
01-03-T2  src/app/(internal)/solutions/(employee)/schedule/page.tsx
          src/app/(internal)/solutions/(employee)/schedule/[id]/page.tsx
          src/app/(internal)/solutions/(employee)/time-sheets/page.tsx
                                             <- the only (employee)/ files in the milestone
02-01-T1  src/lib/actions/jobs.ts
          src/components/admin/jobs-list.tsx
          src/app/(internal)/solutions/(admin)/jobs/page.tsx
          src/app/(internal)/solutions/(admin)/jobs/[id]/edit/page.tsx
02-01-T2  src/components/admin/job-form.tsx
02-02-T1  src/lib/actions/appointments.ts
          src/components/admin/appointment-form.tsx
          src/components/admin/appointments-types.ts
          src/components/admin/new-appointment-schedule-context.tsx
          src/app/(internal)/solutions/(admin)/appointments/page.tsx
          src/app/(internal)/solutions/(admin)/appointments/new/page.tsx
          src/app/(internal)/solutions/(admin)/appointments/[id]/page.tsx
          src/app/(internal)/solutions/(admin)/appointments/[id]/edit/page.tsx
02-02-T2  src/lib/actions/invoices.ts
          src/components/admin/invoice-form.tsx
          src/app/(internal)/solutions/(admin)/invoices/new/page.tsx
          src/app/(internal)/solutions/(admin)/invoices/[id]/page.tsx
          src/app/(internal)/solutions/(admin)/invoices/[id]/edit/page.tsx
03-01-T1  src/lib/actions/client-job-pricing.ts
03-01-T2  src/components/admin/client-job-pricing-form.tsx
          src/components/admin/client-job-pricing-list.tsx
03-01-T3  src/app/(internal)/solutions/(admin)/clients/[id]/pricing/page.tsx
          src/app/(internal)/solutions/(admin)/clients/[id]/pricing/new/page.tsx
          src/app/(internal)/solutions/(admin)/clients/[id]/pricing/[pricingId]/edit/page.tsx
          src/app/(internal)/solutions/(admin)/clients/[id]/page.tsx
```

Files nobody owns and nobody may edit: `supabase/migrations/20260427000000_schema_snapshot.sql`
(landed migration), `supabase/seed.sql` (comments only), and — per DET-12 —
`src/app/(internal)/solutions/(admin)/dashboard/page.tsx` and
`src/app/(internal)/solutions/(admin)/invoices/page.tsx`.

## Out of this roadmap entirely

Deployment to `blhxzilsjuzbeoxtkbap`, any git commit, issue #11 payroll rates, issue #12 automated
invoicing, and a per-client flat quote as a standing rule (KL-01). See `PROJECT.md` non-goals.

> Masking `appointments.price_override_cents` / `billed_price_cents` from employees was listed here
> as out of scope until 2026-09-18. It is now **in** scope as REQ-020, delivered by `01-03`. DET-14
> is closed.
