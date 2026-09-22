# ROADMAP

Revised 2026-09-18 after the human answered ARCH-1…ARCH-6. **Phase 1 was reshaped**, not edited:
ARCH-1 turned an additive migration into a rename, and ARCH-5 added a whole task.

Three phases, six plans, **eleven tasks**. **Phases 2 and 3 have no dependency on each other** and
are intended to run concurrently once Phase 1 has landed.

> **Phase 4 added 2026-09-21** — GitHub issue #18 / REQ-022, scheduled by the user after being
> deferred during #10. Two plans, four tasks, all four concurrent. It is a follow-on to this
> milestone rather than part of its original three phases, and it has its own gate.

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
  - `phases/02-pricing-consumption/02-03-PLAN.md` — **AMD-1 remediation, added 2026-09-21.
    COMPLETE.** The user ratified OQ-R1 as option (a), and both tasks landed: T1 removed the
    unratified `voidInvoice` cache clear from `src/lib/actions/invoices.ts` (formerly `:632-641`),
    T2 undid the matching narrowing in `supabase/checks/pricing_backfill_check.sql`. That file now
    diffs clean against its committed version, confirming the revert is exact. Both were applied
    by the orchestrator after the delegated agent was cut off by a rate limit.
  - The three plans share no writable file and can run at the same time.
- Gate: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` — **all four clean, no
  exceptions**. This is where the constitution's §16 bar is restored. Plus each plan's smoke script.
  **Those four prove almost nothing about this milestone's actual risk** (REQ-017): the clients are
  untyped, so a surviving `base_price_cents` is a runtime 400, not a build error. The gate's real
  content is REQ-004's zero grep and **REQ-021's browser walk over all ten affected routes with
  zero `/rest/v1/` responses ≥ 400**.
- **Blocked on**: Phase 1 only.

## Phase 3 — Client-job pricing admin surface  ·  status: CODE COMPLETE (statically verified only; CRUD smoke script not run)  ·  depends on Phase 1

CRUD for `client_job_pricing` hung off the client detail page, mirroring client-locations CRUD.

- Requirements: REQ-015, **REQ-023** (added 2026-09-21).
- Plan: `phases/03-client-job-pricing-admin/03-01-PLAN.md` — 3 tasks. **All landed**; see
  `03-SUMMARY.md`.
- **`03-02` — archived-rate uniqueness fix, added 2026-09-21, user-approved for this milestone.**
  One task: a migration replacing `client_job_pricing_client_id_job_id_effective_from_key` with a
  partial unique index `WHERE is_archived = false`, plus a check that the action's 23505 → date
  field-error mapping still fires. Owned files: the new migration and
  `src/lib/actions/client-job-pricing.ts`. Closes REQ-023.
- **Does not depend on Phase 2.** Dispatch it in the same block.
- Gate: `npm run lint`, plus the CRUD smoke script. **Corrected 2026-09-18:** `npx tsc --noEmit` is
  clean throughout this milestone (REQ-017), so Phase 3's files must contribute no error *and* the
  whole run must stay clean — an error here is a defect, not Phase 2 ripple. `npm run build` is
  still checked at the Phase 2 gate. The pricing routes are new, so REQ-021 does not cover them;
  their proof is this plan's own browser smoke script.

## Phase 4 — Voiding an invoice releases its appointments  ·  status: NOT STARTED  ·  depends on Phases 1 and 2 (both shipped)

**Added 2026-09-21.** GitHub issue **#18**, which is REQ-022 — the defect AMD-1 uncovered during
the #10 review, deferred by the user then and scheduled by the user now. It is a **pre-existing**
defect, not introduced by #10.

Voiding an invoice is terminal, and `invoice_appointments_appointment_id_key UNIQUE
(appointment_id)` is global and status-blind, so a visit that was invoiced, disputed and voided can
never be billed again. This phase replaces that constraint with a partial unique index over **live**
junction rows, makes `voidInvoice` mark its own rows released and clear their display cache,
teaches both invoice builders to ignore released rows, and narrows the check script's two cache
invariants to match.

- Requirements: **REQ-022** (whole), plus the amendments it forces — REQ-002 (AMD-3, AMD-3b) and
  REQ-018 (AMD-4).
- Plans — **two, four tasks, all four dispatchable immediately and concurrently**:
  - `phases/04-void-releases-appointments/04-01-PLAN.md` — the migration + the one `database.ts`
    field (T1, `coder-sr`); the check-script narrowing (T2, `coder-jr`).
  - `phases/04-void-releases-appointments/04-02-PLAN.md` — `voidInvoice` (T1, `coder-sr`); both
    builder queries (T2, `coder-jr`).
  - Read `04-CONTEXT.md` before any of them. §2 resolves issue #18's "scoped to non-void invoices"
    phrasing against REQ-022(b)'s `is_archived` predicate — the index keys on the release marker
    because a partial index cannot read another table.
- **Gate — all-or-nothing (REQ-022).** No task in this phase passes alone; a partial fix leaves a
  visit that looks billable and is not. The gate is: `npm run lint`, `npx tsc --noEmit`,
  `npm run build`, `npm test` all clean; `04-01-PLAN`'s **E1–E6** SQL evidence as row counts
  (constitution §16), including the pair that *is* REQ-022(b) — a second **live** junction row
  rejected with 23505, and the same insert **accepted** once the first row is released; the
  **user's manual browser pass** (`04-02-PLAN`'s 18-step script — the user runs every browser pass
  in this project and no agent starts one); and `pricing_backfill_check.sql` §3 all 0 **run after
  that pass has left a released row in the database** — a run against a database with no voided
  invoice proves nothing about the new predicate.
- **The local database is a shared resource and only the verifier touches it** (D-32,
  `04-CONTEXT.md §7.0`). The four coders run **static gates only** — diff, grep, lint, `tsc`, and
  `build` for `04-02-T2`. Every DB-state criterion is executed once, serially, in a single verifier
  pass after all four land, because E1's "0 rows after reset" counts and E5's fixture rows falsify
  each other if they run concurrently. The **DOWN path (E6) is the verifier's**, so `04-01-T1`
  ships its header with the precedent's "NOT yet executed" wording; the verifier cannot edit files,
  so on success it reports the header line to correct and the orchestrator dispatches that one-line
  edit as the phase's last change.
- **Verdict contract: PASS or BLOCKED.** Until the user's browser pass is reported back, the
  phase-level verdict is **BLOCKED** and the next action is to relay the script — not to close the
  phase. There is no "verified, phase not closed".
- **Deploy order** (D-33, for the human who ships it — constitution §5): the migration goes out
  **first or together with** the application code, **never the code alone**. Code-first is exactly
  the half-fix REQ-022 forbids. Carry this into the phase summary handed to the user.
- **Blocked on**: nothing. Phases 1 and 2 shipped; the column the whole phase keys on
  (`invoice_appointments.is_archived`) has existed since `20260918120000` and is already typed.
- **Open question**: OQ-V1 — whether the migration also releases appointments consumed by invoices
  voided *before* it ran. Default is **forward-only** (constitution §7 forbids a migration changing
  a stored amount on `appointments`); the remediation SQL ships commented in the migration header
  with a sizing query. Affects `04-01-T1` only, and only its commented block.

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
02-03-T1  src/lib/actions/invoices.ts          <- same file as 02-02-T2; 02-02-T2 has shipped, so
                                                 no live overlap, but never dispatch them together
02-03-T2  supabase/checks/pricing_backfill_check.sql
                                              <- held by a concurrent agent as of 2026-09-21;
                                                 wait for its release before dispatching
03-01-T1  src/lib/actions/client-job-pricing.ts
03-01-T2  src/components/admin/client-job-pricing-form.tsx
          src/components/admin/client-job-pricing-list.tsx
03-01-T3  src/app/(internal)/solutions/(admin)/clients/[id]/pricing/page.tsx
          src/app/(internal)/solutions/(admin)/clients/[id]/pricing/new/page.tsx
          src/app/(internal)/solutions/(admin)/clients/[id]/pricing/[pricingId]/edit/page.tsx
          src/app/(internal)/solutions/(admin)/clients/[id]/page.tsx
```

### Phase 4 dispatch — one block, four-wide, no internal dependencies

```
block 4 (all four concurrent, no edges between them)
──────────────────────────────────────────────────────
04-01-T1  coder-sr  20260921130000_void_releases_appointments.sql + database.ts
04-01-T2  coder-jr  pricing_backfill_check.sql — both cache invariants
04-02-T1  coder-sr  voidInvoice — release + clear
04-02-T2  coder-jr  invoices/new + invoices/[id]/edit — one .eq() each
                                          │
                                          └──▶ verifier (whole phase) ──▶ user browser pass
```

**File exclusivity makes the four concurrent; the single local database does not.** All four coders
run static gates only, and every database check in the phase belongs to the one serial verifier
pass drawn above (D-32). That is a verification constraint, not a dependency — it does not narrow
the block, it just means no coder resets or fixtures a database another coder is reading.

**There is deliberately no edge from `04-01-T1` to anything.** The tempting sequencing — "migration
and types first, then the queries and the action" — is habit, not a dependency.
`invoice_appointments.is_archived` has existed since
`20260918120000_hourly_pricing_and_client_job_pricing.sql:142-145` and is already typed in
`src/types/database.ts:487,497,507`, so every query and update `04-02` writes compiles,
type-checks and executes against the database as it stands at `926f088`. They simply have no
*effect* until the index lands. The only thing that needs all four is **verification**, and that is
a gate property. Serialising here would turn a one-block phase into a four-block one for nothing.

**Critical path**: any single task → verifier → the user's browser pass. **One working block.**
That is the floor, and the phase is already at it.

**Owned-file union — zero collisions:**

```
04-01-T1  supabase/migrations/20260921130000_void_releases_appointments.sql   (new)
          src/types/database.ts                                              (one field)
04-01-T2  supabase/checks/pricing_backfill_check.sql
04-02-T1  src/lib/actions/invoices.ts                                        (voidInvoice only)
04-02-T2  src/app/(internal)/solutions/(admin)/invoices/new/page.tsx
          src/app/(internal)/solutions/(admin)/invoices/[id]/edit/page.tsx
```

Files this phase reads and **must not edit**: every landed migration,
`src/app/(internal)/solutions/(admin)/invoices/[id]/page.tsx` (the voided invoice must keep
rendering its released lines), `src/components/admin/invoice-form.tsx`, and everything under
`src/lib/pricing/`.

`src/lib/actions/invoices.ts` was `02-02-T2`'s and then `02-03-T1`'s; both have shipped, so
`04-02-T1` takes it with no live overlap. `src/types/database.ts` was `01-01-T1`'s, likewise
shipped. `supabase/checks/pricing_backfill_check.sql` was `02-03-T2`'s, likewise shipped — the
concurrent-agent hold noted below was released on 2026-09-21.

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
