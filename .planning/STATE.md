# STATE

Milestone: hourly job pricing + per-client negotiated rates (issue #10).
Baseline: `improved-appointments` @ `7ae55f5`.

## Position

<!-- Owned by the orchestrator. Planner does not write below this line until the next section. -->

- **Current phase**: **Phase 1 — COMPLETE and verified 2026-09-18.** Next phase: Block 2
  (Phase 2 + Phase 3), not started.
- **Phase status**: all five Phase 1 tasks landed and independently verified against a live local
  stack by the orchestrator — not accepted on any agent's word, and not on any exit code.
  `01-01-T1`, `01-01-T2`, `01-02-T1`, `01-03-T1`, `01-03-T2` all complete.
- **Last verified commit**: `7ae55f5`. **Nothing is committed and nothing may be.** Working tree
  carries all milestone work as uncommitted changes, by design. `git diff --cached` is empty.
- **Tasks complete**:
  - `01-01-T1` — migration A, `src/types/database.ts`, `supabase/checks/pricing_backfill_check.sql`.
  - `01-01-T2` — `scripts/seed-admin-users.ts` (host guard + fail-loud + read-back),
    `supabase/test-data.sql` (hourly rates, `Hourly Deep Clean`, one `client_job_pricing` row).
  - `01-02-T1` — `src/lib/pricing/{money,resolve,lookup}.ts` + tests. **17/17 pass.**
  - `01-03-T1` — migration B: both employee policies dropped, two definer views,
    `get_employee_location_ids()`, `client_locations` policy repaired.
  - `01-03-T2` — the three `(employee)/` route files re-pointed at the views. Exactly six changed
    lines, all PostgREST aliases; nothing else in those files moved.

### Phase 1 verification evidence (2026-09-18, orchestrator, first-hand)

- `supabase db reset` applies both new migrations cleanly, in timestamp order.
- Schema asserted from `information_schema`: `jobs` has `hourly_rate_cents` and neither
  `base_price_cents` nor `pricing_mode`; `client_job_pricing` exists with only the admin policy;
  both employee views exist; both dropped policies are gone; `get_employee_location_ids` exists.
- **B-01 proven in both directions on a real row**: `UPDATE invoice_appointments` succeeds
  (`UPDATE 1`); drop `updated_at` to recreate the pre-migration shape and the identical statement
  raises `record "new" has no field "updated_at"`.
- CHECKs enforced: negative rate rejected / zero accepted; `billed_rate_cents` xor
  `billed_minutes` rejected, both-set and both-null accepted; duplicate
  `(client_id, job_id, effective_from)` rejected, differing dates accepted.
- **DOWN SQL of both migrations executed against the reset DB — both apply cleanly** and restore
  `base_price_cents` and all three policies. Rolled back; UP state intact.
- `pricing_backfill_check.sql` is read-only (no line-initial DML/DDL) and runs clean; **all five
  section-3 invariants report 0.**
- **REQ-017 runtime evidence captured**: as admin,
  `GET /rest/v1/jobs?select=id,name,base_price_cents` → `400 {"code":"42703"}`, and the embedded
  form → the same for `jobs_1.base_price_cents`; the renamed column returns 200. This is what every
  missed Phase-2 call site will do.
- **REQ-020 / D-21 proven at the PostgREST layer as the seeded employee**: `client_job_pricing` →
  `[]` (admin → rows); `jobs` and `appointments` base tables → `[]`; both views return rows but
  **400/42703 when any price column is requested**; view grants are `SELECT` only for
  `authenticated` + `service_role`; an employee `PATCH` through a view → `403 / 42501` with the base
  row unchanged.
- **B-06 repaired and proven**: as the employee, `client_locations` still returns the job-site
  address (`123 Main St, Nashville, TN 37201`).
- **B-07 closed**: the seed logs its resolved host, exits **1** naming the failed write when an
  insert is forced to fail, and exits 0 only when its read-back confirms the rows.
- Seed row counts asserted **by SQL after the run**, and the derived charge asserted in SQL:
  120 scheduled minutes at `4500` → `9000`. Two full back-to-back sequences produce **identical**
  count sets.
- `npx tsc --noEmit` clean (zero output); `npm test` 17/17; `npm run lint` unchanged at the
  pre-existing 22 problems, none in a file this milestone touched.
- Employee screens verified by running each file's **actual** query shape as the seeded employee:
  all three HTTP 200 with client, job and address nested correctly, and no price key in any payload.

### Resolved this session

- **B-05 / AS-10 — RESOLVED FAVOURABLY, empirically.** PostgREST **does** infer the two-level
  view→view embed chain (`appointment_employees_employee_view → appointments_employee_view →
  jobs_employee_view`), and `clients` / `client_locations` embeds resolve off a view. **The
  JS-stitching fallback was not needed and is not used.** The employee screens cost the same number
  of round trips as before.
- **New defect found and fixed during verification** (not in any plan): `appointment_employees` has
  **no unique constraint** on `(appointment_id, employee_id)`, so the seed script's
  `code === '23505'` branch was dead code and every run duplicated Sarah's assignment — the seed was
  **not idempotent** (count went 2 → 3). This is the same mechanism that produced the duplicate row
  in the production incident. Fixed inside `01-01-T2`'s owned file with the read-before-insert
  pattern the rest of the script already uses. Idempotency now proven by identical count sets.
- **Known-good state**: `npx tsc --noEmit` is **clean, exit 0, and must stay clean at every gate
  from here on.** There is no expected-noise allowance. The earlier plan premise — that the rename
  would leave ~57 errors across 21 files — was **false and is withdrawn** (D-22 / rewritten
  REQ-017): no Supabase client is parameterized with `Database`
  (`src/lib/supabase/admin.ts:6`, `src/lib/supabase/server.ts:6` are both `SupabaseClient<any>`),
  so the rename produces zero type errors. **The 57 call sites break at runtime instead**, as
  PostgREST `42703` responses on real pages. Phase 2 has no compiler safety net; the sweep is
  grep-driven and must be proven by loading each affected route in a browser (REQ-021).
- **Standing evidence rule for this milestone**: an exit code, a console success line, or a clean
  grep is not proof. This run has already produced two green-signal-over-broken-reality defects —
  the vacuous `tsc` gate, and `scripts/seed-admin-users.ts` printing success and exiting 0 while
  inserting nothing (B-07). Assert on row counts and HTTP responses.
- **Next action**: **Block 2 — the seven remaining Phase 2 / Phase 3 tasks, dispatchable
  concurrently** (`01-03-T2` is already done, so the block is seven-wide, not eight):
  `02-01-T1` (jobs action/list/routes), `02-01-T2` (job-form), `02-02-T1` (appointments),
  `02-02-T2` (invoices), plus the Phase 3 tasks in `.planning/phases/03-client-job-pricing-admin/`.
  Their exclusive file ownership is listed in `ROADMAP.md` lines ~178-215. After the block:
  a verifier pass over the combined state, then `/code-review`, then the Phase 2 gate —
  which per D-22 **rests on REQ-004's grep plus REQ-021's browser walk of all ten affected routes,
  not on `tsc`/`lint`/`build`**, all three of which pass straight over a missed call site.
- **Session note**: an earlier rate limit killed two agents mid-write. On resume 2026-09-18 the tree
  was re-checked against disk rather than trusted: `01-01-T1` and `01-03-T1` were found **already
  complete** (STATE.md had them as in-flight/not-started), and `01-01-T2` was found **half done** —
  the seed script was rewritten but `supabase/test-data.sql` had never been touched. Re-check disk,
  not this file, after any interruption.
- **PRODUCTION INCIDENT, 2026-09-18 — unresolved, user notified.** `npm run seed:admin` wrote to
  the **live** project twice (during `01-01-T1` and `01-03-T1`). Verified by the orchestrator:
  `.env.local:5` is the production URL, `scripts/seed-admin-users.ts:15-16` builds a service-role
  client from it, and the script has **no local guard**. It reset two production passwords to the
  hardcoded `admin123` (`:43`) / `employee123` (`:49`), upserted both `employees` rows over seed
  constants, and inserted an `appointment_employees` row. `docs/local-setup.md:63-68` wrongly
  documents this as a local step. `supabase/.temp/project-ref` is populated, so a bare
  `supabase db push` would also reach production.
  **Nothing was undone** — undoing needs another remote write. Passwords must be rotated by a human.
  This also corrects an earlier misdiagnosis: the "seed script silently no-ops" finding (B-07) was
  wrong. The script worked perfectly, against the wrong database, while the agent counted rows
  locally.
  **Standing rule for every remaining task: no agent runs `npm run seed:admin` until
  `01-01-T2` lands a hard guard refusing any host but `127.0.0.1`/`localhost`.**
- **`/code-review high` run 2026-09-18 over the combined tree. Triaged; nothing fixed.**
  - Its two "critical" findings — ~16 surviving `base_price_cents` call sites, and
    `billed_amount_cents SET NOT NULL` breaking `invoices.ts`'s `{invoice_id, appointment_id}`
    inserts — are **the planned Phase 1 state, not defects** (D-19: Phase 1 ships ahead of its call
    sites). `02-01-T1` and `02-02-T2` own exactly those files. They are, however, an independent
    confirmation that **this tree must not be pushed until Phase 2 lands**.
  - "No reader for `src/lib/pricing/`" and "no client is typed with `Database`" are likewise known
    and recorded (Phase 2 adoption; D-22).
  - `tsconfig` excluding `tests` from `tsc` is the accepted DET-8 trade-off. One genuine nit:
    `src/lib/pricing/lookup.ts:4` imports `'./resolve'` without the `.ts` extension while
    `resolve.ts:1` imports `'./money.ts'` with it. Harmless (`lookup.ts` is never loaded by
    `node --test`), worth settling in Phase 2.
  - **Forward-looking item for Phase 2**: `20260918120000...sql:204`'s comment asserts
    `billed_price_cents` is "written only by createInvoice/updateInvoice", which is DET-9's plan but
    is **not true yet**. Until `02-02-T2` implements it, `pricing_backfill_check.sql`'s
    "still priced live" section would misclassify newly-invoiced appointments. `02-02-T2` must
    close this; it is the plan's stated intent, not drift.
  - **Two real, NEW bugs in already-committed issue-#8 code (`1b22ef7`), outside this milestone —
    surfaced, deliberately not fixed here** (fixing committed work inside an uncommitted pricing
    diff would bury it, and both involve a product decision):
    1. `src/lib/actions/appointments.ts:922` `cancelAppointment` has **no status filter**, so a
       `completed` appointment can be cancelled; `uncancelAppointment` (`:949`) then restores it to
       `'scheduled'` unconditionally. completed → cancel → reopen **silently loses the completion**.
    2. The edit guard is now `status === 'completed'` only (`:663`, and
       `(admin)/appointments/[id]/edit/page.tsx:147`), so **cancelled appointments are editable**,
       and `updateAppointment` delete/re-inserts every `appointment_employees` row (`:755-775`) —
       discarding `clocked_in_at`/`clocked_out_at`. An employee's logged hours can vanish.
- **SECURITY FINDING, out of scope, unfixed — needs its own issue.** `src/app/(auth)/login/page.tsx`
  lines **27-28** log the submitted email *and password* in plaintext on every login attempt
  (`console.log('Password provided:', password)`). Observed live in the dev-server output during
  this session's browser pass and confirmed by grep. It is **pre-existing and already committed on
  this branch** — it is not part of this milestone and was deliberately **not** fixed here, because
  folding a security fix into an uncommitted pricing milestone would bury it. File it separately and
  fix it on its own commit.
- **Not yet done, deliberately**: no commit, no `supabase db push`, no `supabase link`.
- **Still outstanding for the human, unchanged**: B-04 — run
  `supabase/checks/pricing_backfill_check.sql` against a **restore of production** before any
  deploy. Nobody has yet measured how far real job prices move under D-09. The local run proves the
  script works; it says nothing about production. Passwords from the incident still need rotating.

---

## Decisions

Rows marked **human-confirmed 2026-09-18** are the answers to ARCH-1…ARCH-6, relayed by the
orchestrator. They are settled; do not reopen them.

| # | Decision | Reasoning |
|---|---|---|
| D-01 | Plan against **stock Next 16.2.4 semantics**, while still requiring each executing agent to read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` and `.../03-api-reference/04-functions/revalidatePath.md` before editing a server action. | `AGENTS.md` claims breaking changes; the vendored docs are the stock Next 16 docs and `package.json` pins plain `next@16.2.4`. The claim is unsupported, but the project rule to consult the docs costs nothing and this milestone adds no new framework pattern anyway. |
| D-02 | **Amended 2026-09-18.** The *effective* price is derived, never stored. The *billed* price is stored twice — canonically on `invoice_appointments.billed_amount_cents`, and as a read-only denormalized copy on `appointments.billed_price_cents`. | Original D-02 said "never stored on `appointments`". ARCH-2's hybrid answer overrides that for the invoiced case only. Un-invoiced appointments are still fully derived, so a rate change still costs no fan-out. |
| D-03 | **Amended 2026-09-18.** The charge is frozen on the invoice line (`invoice_appointments.billed_*`), which remains the single source of truth for invoice totals. The appointment-side copy is a display cache, never an input. | Keeps ARCH-2 option C's guarantee (totals never recompute) while satisfying the human's requirement that the appointment list show real per-visit cost. |
| D-04 | Four → **three** `billed_*` columns on the existing junction, not a new `invoice_line_items` table. | `invoice_appointments` already has the PK, the FKs and the uniqueness. A line-item table only earns its keep once invoices need ad-hoc lines, which is #12's problem. |
| ~~D-05~~ | **Withdrawn 2026-09-18.** Was: "keep the column name `jobs.base_price_cents`". | ARCH-1 renames the column. D-05's premise (a mode discriminator keeping the old column meaningful) no longer exists. |
| D-06 | Repair the latent `invoice_appointments` UPDATE fault as part of this migration. | REQ-006's backfill *is* an UPDATE on that table, and it would fail today (B-01). Prerequisite, not scope creep. Human-confirmed in scope 2026-09-18. |
| D-07 | `node --test` with Node's native TypeScript stripping; **no new dependency**. | Verified working on the installed Node v25.8.1 (`node --test "tests/**/*.test.ts"`). Zero devDependency test tooling exists and the code under test is pure functions. |
| D-08 | Split the jobs UI from the jobs action, and the pricing components from the pricing routes, into separate tasks with specified contracts. | Both splits are false dependencies once the interface is written down. Writing it down turns sequential tasks into concurrent ones. |
| **D-09** | **ARCH-1 = single hourly rate, no mode toggle. Human-confirmed 2026-09-18.** `jobs.base_price_cents` is **renamed** to `hourly_rate_cents`, keeping `integer NOT NULL` and its exact stored value. **No division by duration, no recalculation, no compensating conversion.** A job at `base_price_cents = 12000` becomes `$120.00/hour`. There is no `pricing_mode` on `jobs`. | The human's explicit choice over "divide by estimated duration to preserve current job cost", made in full knowledge that it changes every job's effective total price. Recorded as a deliberate business reinterpretation. Executors must not soften it. |
| **D-10** | **ARCH-2 = hybrid freeze. Human-confirmed 2026-09-18.** `invoice_appointments` carries the canonical frozen line and remains the source of truth for `invoices.total_cents`. `appointments` additionally carries the billed amount once invoiced; before invoicing the appointment shows the live derived price. | The admin appointment list must distinguish two appointments of the same job by real cost at a glance. |
| **D-11** | **Planner's ARCH-2 column call: a new `appointments.billed_price_cents integer NULL`. `price_override_cents` keeps its present meaning untouched.** Deviates from the original ARCH-2 option C recommendation, which stored nothing on the appointment at all. | `price_override_cents` is the resolver's *highest-precedence input*. Writing the billed amount into it makes resolution self-referential: the next read would report a frozen invoice amount as a manual override the admin never typed, and `appointment-form.tsx` would pre-fill its override field with it. That is exactly the ambiguity this milestone exists to delete — and it is the very side effect `CODEBASE-MAP.md §6` flags at `invoices.ts:185-194`. Two meanings in one nullable integer would also make `resolve.ts`'s precedence rules unreadable. |
| **D-12** | **ARCH-3 = B. Human-confirmed 2026-09-18.** `effective_from` per `client_job_pricing` row; the newest non-archived rule with `effective_from <= appointment.scheduled_date` wins. No `effective_to`. | Ending a rate means inserting the next one. History is inherently preserved. |
| **D-13** | **ARCH-4 = A. Human-confirmed 2026-09-18.** Billing uses `scheduled_end_time - scheduled_start_time`. Clocked times are never read for money. | The price is known at booking and never moves. Clock data is employee-driven and frequently incomplete. |
| ~~D-14~~ | **Superseded by D-21 later the same day.** Was: "ARCH-5 = B — employees must not read `jobs.hourly_rate_cents` or anything in `client_job_pricing`", scoped to the rate *cards* only. | The human's revised answer widened it to every price an employee can reach, including on their own appointments. Preserved here because the two are materially different pieces of work and the record should show the widening rather than quietly absorb it. |
| **D-21** | **ARCH-5 = (b) — full price confidentiality. Human-confirmed 2026-09-18, superseding D-14.** Employees must not be able to read **any** price: not `jobs.hourly_rate_cents`, not anything in `client_job_pricing`, and **not `appointments.price_override_cents` or `appointments.billed_price_cents` — including on appointments they are assigned to.** Both `"Employee select jobs"` and `"Employee select assigned appointments"` are dropped and replaced by `security_invoker=false` views (`jobs_employee_view`, `appointments_employee_view`) that carry the dropped policies' row filters in their own bodies and list their columns explicitly. Nothing replaces the hidden figures in the employee UI. | The requirement is genuine confidentiality, not tidiness: what a client is billed and what an employee is paid are two different numbers, and the pay side (#11) does not exist yet, so there is nothing an employee is entitled to infer. Column masking is the only mechanism that achieves it — RLS is row-level and cannot hide a column however carefully the app's own queries are written (constitution §10). This closes the hole the planner flagged as DET-14 and the human reversed. Cost: `01-03` became two sequential tasks and `"Employee select locations for assigned appointments"` needs repairing as collateral — see REQ-020 and B-05. |
| **D-15** | **ARCH-6 = A. Human-confirmed 2026-09-18.** The rate is per visit-hour. A 2-hour appointment at $45/h bills $90 whether 1 or 3 cleaners attend. | Crew size is a scheduling decision, and it collides with #11's cost-side rate. |
| **D-16** | **DET-4 decided by the planner, not asked: `client_job_pricing` is hourly-rate-only.** One `hourly_rate_cents integer NOT NULL` column. No `pricing_mode`, no `flat_price_cents`. | With no mode on `jobs` (D-09), reintroducing one on the *newer* table would make the two pricing surfaces disagree about what a price is, and would restore exactly the two-branch resolver, two-branch CHECK, mode select and mode-aware formatting that D-09 was chosen to delete. The issue's own framing ("a different price per customer/job combination", loyalty discounts) is a rate negotiation, and a *rate* is what the business now bills in. A genuinely fixed-quote visit still has an unchanged escape hatch: `appointments.price_override_cents`. Reversal is cheap and additive if the business ever needs it — a nullable `flat_price_cents` plus a `pricing_mode text DEFAULT 'hourly'`. Nothing is foreclosed. |
| **D-17** | `invoice_appointments` gets **three** `billed_*` columns, not four: `billed_amount_cents NOT NULL`, `billed_rate_cents NULL`, `billed_minutes NULL`. No `billed_pricing_mode`. | With `pricing_mode` gone from the schema (constitution §8), a lone `billed_pricing_mode` would be the last survivor of a deleted concept and could contradict its neighbours. The distinction it carried is fully derivable: **`billed_minutes IS NULL` means the line is a flat amount** (a manual override, or a legacy row backfilled from before this milestone); non-null means it is `round(billed_rate_cents × billed_minutes / 60)`. A CHECK enforces both-or-neither. |
| **D-18** | `jobs.estimated_duration_minutes` **stays**, and plays no part in pricing. | Removing it is unrelated scope. It remains a scheduling hint, displayed read-only at `appointments/[id]/page.tsx:229-230`, and the blast-radius check script uses it to estimate the reinterpretation's impact per job. The job form's helper text must say explicitly that it does not affect price. |
| **D-19** | **Half falsified 2026-09-18 by D-22.** Was: "Phase 1 deliberately ships a tree where `npx tsc --noEmit` and `npm run build` **fail**, with an enumerated, bounded error set." **`tsc` does not fail — it is clean.** What survives is the *sequencing* half, on its original reasoning: Phase 1 still ships ahead of its call sites, its gate is still migration + seeds + `npm test` + `lint`, and `npm run build` still returns at the Phase 2 gate. The tree it ships is inconsistent at **runtime** (a page querying `base_price_cents` 400s), never red in `tsc` or `build`. | The premise was wrong about the mechanism, not the schedule. The rename touches ~57 call sites across eight files that four Block-2 tasks own exclusively. Folding those into Phase 1 would either collide with every Block-2 task or serialise the whole milestone behind one mechanical sweep — one extra block on the critical path for zero benefit. Phase 1's gate is therefore migration + seeds + `npm test`; the full bar returns at the Phase 2 gate. |
| **D-22** | **The Supabase clients are untyped, so the rename has no compiler safety net. Verified 2026-09-18, after `01-01-T1` completed and was verified.** `createAdminClient()` (`src/lib/supabase/admin.ts:6`) and `createClient()` (`src/lib/supabase/server.ts:6`) both call the factory **with no `Database` generic**, so both are `SupabaseClient<any>`. Every one of the 57 `base_price_cents` sites is either a read through an untyped client into a hand-declared local row type, or a string literal inside a `.select(...)`. With the rename landed, `npx tsc --noEmit` returns **exit 0, clean**. The breakage is entirely at runtime: `GET /rest/v1/jobs?select=id,name,base_price_cents` → `400 {"code":"42703","message":"column jobs.base_price_cents does not exist"}`; the embedded form `appointments?select=id,jobs!inner(id,name,base_price_cents)` → the same for `jobs_1.base_price_cents`. | **What it costs Phase 2:** the 21-file sweep in `01-RESEARCH.md §10` must be done by grep, file by file, with no compiler enumerating the work and no build failure catching a miss — a missed site is a silent 400 on a live admin page. Phase 2's gate therefore rests on REQ-004's zero grep plus **REQ-021's browser walk over all ten affected routes**, not on `tsc`/`lint`/`build`, all three of which pass straight over the defect. REQ-017 was vacuous under the old premise (it could be neither satisfied nor falsified) and has been rewritten around this. Same root cause as the two `src/lib/pricing/lookup.ts` errors: `01-01-T1` also had to add `Relationships` and `Functions` members to `src/types/database.ts` for `Database` to satisfy postgrest-js's `GenericSchema` — without them `Schema` resolved to `never` and `from(...).select(...)` returned `never` rows, so adding `client_job_pricing` alone did **not** clear them. Typing the clients with `Database` would give the project a real safety net, but doing it inside this milestone would surface every pre-existing schema drift at once, in files four concurrent tasks own. Out of scope here; worth its own issue. |
| **D-20** | Seeded job prices change from `15000` to `4500`. | `Standard House Cleaning` at `15000` would read as `$150.00/hour` locally, which makes every seeded appointment absurd and hides real bugs behind implausible numbers. This is local seed data only; it says nothing about production, which is reinterpreted in place per D-09. |

## Assumptions

| # | Assumption | If wrong |
|---|---|---|
| ~~AS-01~~ | Resolved by D-09. | — |
| ~~AS-02~~ | Resolved by D-13. | — |
| ~~AS-03~~ | Resolved by D-15. | — |
| ~~AS-04~~ | Resolved by D-09 — existing jobs *are* converted, by reinterpretation. | — |
| ~~AS-05~~ | Resolved by D-12. | — |
| ~~AS-06~~ | Resolved by D-14 — the opposite of what was assumed. | — |
| AS-07 | Client rules carry an **absolute** rate, never a percentage discount (DET-3). | Rounding gains a second stage, violating constitution §3 as written. |
| AS-08 | No minimum billable duration and no billing increment — exact scheduled minutes are billed (DET-6). | `hourlyAmountCents` gains a floor/increment parameter and REQ-005's cases change. |
| AS-09 | There is live data in `jobs`, `appointments`, `invoices` and `invoice_appointments` on `blhxzilsjuzbeoxtkbap`, but the planner has **never seen it**. | Under D-09 this matters more than it did: the reinterpretation's blast radius is unknown until `pricing_backfill_check.sql` is run against a copy of production. That is why REQ-002 was rewritten into a reporting requirement. |
| AS-10 | **Widened by D-21.** PostgREST can resolve an embed into a definer view — now needed **two levels deep** (`appointment_employees_employee_view → appointments_employee_view → jobs_employee_view`), plus the `clients` / `client_locations` embeds hanging off a view rather than a base table. | `01-03-T2`'s three queries fall back to multiple round-trips with JS stitching. The task carries that fallback explicitly and per-file, so this costs rework inside one task, not a replan. It is why `01-03-T2` is `coder-sr` and why it is sequenced after `01-03-T1` — the answer is empirical and cannot be known before the views exist. |
| AS-11 | **Confirmed, and now load-bearing.** No employee-facing screen displays any price today: all three job embeds select only `name` / `description`, and the appointment embeds select no price column. Verified at `7ae55f5` (`01-RESEARCH.md §12`). | If any employee screen *did* show a price, D-21 would need a product decision about what replaces it. None does, so the answer is KL-02: nothing replaces it. This also means the UI cannot be used as evidence that REQ-020 works — hence its acceptance is written at the PostgREST layer, not the screen. |

---

## Resolved architecture decisions (record)

> ARCH-1…ARCH-6 were relayed to the human and answered on **2026-09-18**. The answers are recorded
> above as D-09 through D-15. Nothing in this section is open. It is kept as the audit trail of
> what was asked, what was recommended, and where the human overruled the recommendation.

| # | Question | Recommended | **Answered** | Deviation? |
|---|---|---|---|---|
| ARCH-1 | Does hourly pricing replace the flat job price, or join it? | **B** — add a `pricing_mode` discriminator, keep `base_price_cents`, lossless | **A′ — replace, by rename, with no recalculation** (D-09) | **Yes.** The human accepted that every job's effective total price changes, in exchange for one pricing concept instead of two. This is the deviation that forced Phase 1 to be replanned rather than edited. |
| ARCH-2 | Where is the charged amount computed, and where frozen? | **C** — freeze on the invoice line only; appointments stay fully derived | **Hybrid: C plus an appointment-side copy** (D-10) | **Yes, partially.** C's guarantee is kept; a bounded, one-time denormalized write is added on top. Not option B — there is no recompute fan-out (see "Write path", `01-CONTEXT.md`). |
| ARCH-3 | Does client pricing keep history? | **B** — `effective_from` only | **B** (D-12) | No. |
| ARCH-4 | Scheduled time or clocked time? | **A** — scheduled | **A** (D-13) | No. |
| ARCH-5 | Should employees stop seeing job rates? | **A** — leave visibility unchanged, raise as its own issue | first **B — mask job rates** (D-14), then revised the same day to **(b) — mask every price, appointment price fields included** (D-21) | **Yes, twice over.** The first answer reversed the recommendation; the revision then widened it past what the planner had scoped, closing DET-14. Adds `01-03-PLAN.md` (two tasks) to Phase 1 and changes live employee behaviour on three screens. |
| ARCH-6 | Per visit-hour or per employee-hour? | **A** — per visit-hour | **A** (D-15) | No. |

Two further items were decided by the planner rather than returned to the human, per the
orchestrator's instruction to prefer deciding: **DET-4** (see D-16) and the **ARCH-2 column
choice** (see D-11). Both are recorded with their reasoning and both are cheap to reverse.

---

## Open questions — DETAIL (defaults applied; execution proceeds)

| # | Question | Default applied | Why |
|---|---|---|---|
| DET-1 | Rounding rule for `rate × minutes / 60`. | `Math.round((rateCents * minutes) / 60)` — half rounds up. Applied once per invoice line; totals are integer sums of rounded lines. | `Math.round` is half-toward-+∞, which for non-negative money is half-away-from-zero — what a customer expects. Integers multiplied before dividing keeps the result exact far beyond any realistic rate × minutes. |
| DET-2 | When regenerating future occurrences of a recurring appointment, should the source occurrence's `price_override_cents` be copied forward (`appointments.ts:847`)? | **No** — regenerated occurrences get `price_override_cents = NULL` and `billed_price_cents = NULL`. | A manual override is a one-off correction; copying it forward is what made per-client pricing necessary. The persistent negotiated price now lives in `client_job_pricing`. Flag: this changes the amount on regenerated future occurrences of any series whose source has an override. |
| DET-3 | Can a client rule be a percentage discount instead of an absolute rate? | No — absolute cents only. | A percentage introduces a second rounding stage, which constitution §3 forbids. A 10% loyalty discount is entered as the resulting rate. |
| DET-4 | **Superseded.** Was: "can a client rule use a different mode from its job?" | Decided as D-16: there are no modes; `client_job_pricing` is hourly-rate-only. | See D-16. |
| DET-5 | Are zero-cost rates allowed? | Yes, `>= 0`. Negative is rejected by CHECK and by the parser. | Today's parsers already accept 0 (`jobs.ts:65`, `invoices.ts:72`). A comped visit is a real thing. |
| DET-6 | Minimum billable duration or billing increment? | None — exact scheduled minutes. | Nobody asked for it, and it is a one-parameter change to `hourlyAmountCents` later. |
| DET-7 | Test runner. | Node's built-in `node --test` with native TS stripping; `npm test` = `node --test "tests/**/*.test.ts"`. Verified on Node v25.8.1. | No new dependency; the code under test is pure functions. |
| DET-8 | **Amended 2026-09-18.** How do Node's required `.ts` import specifiers coexist with `tsc`? | **Both**: `"allowImportingTsExtensions": true` is added to `compilerOptions`, **and** `tests/` stays in `tsconfig.json`'s `exclude`. `tsconfig.json` belongs to `01-02-T1`'s owned set. | The original entry said the exclude existed *specifically so that no compiler option had to change*. That reasoning no longer holds and the record should not read as though nothing was touched. What changed: `src/lib/pricing/resolve.ts` needs a **value** import from `money.ts`, and Node's native type stripping requires the literal `./money.ts` specifier — that is inside `src/`, which `next build` type-checks, so no amount of excluding `tests/` avoids TS5097. The option is legal here because the project already sets `"noEmit": true`, which is exactly the precondition `allowImportingTsExtensions` requires. The exclude nonetheless **stays**, for a different and narrower reason than before: keeping test files out of the production build's type-check surface. Consequence, unchanged: test files are not type-checked by `npm run build`. Accepted. |
| DET-9 | **Rewritten 2026-09-18.** What does invoicing write back to the appointment? | Invoicing no longer writes `appointments.price_override_cents` — that column becomes purely admin-typed input. Invoicing **does** write `appointments.billed_price_cents`, in the same action that writes the junction rows, and clears it for appointments removed from the invoice. | The original DET-9 said invoicing stops writing to `appointments` altogether; D-10 overrides that. The distinction that matters is preserved: the invoice never mutates a *pricing input*, only a *display cache*. |
| DET-10 | Does the appointment form show the client-specific rate before saving? | Yes, server-resolved and passed to `appointment-form.tsx` as a prop, replacing the client-side rate read at `appointment-form.tsx:197`. | Resolution needs a DB lookup, so it cannot stay in the Client Component. On `/appointments/new` the client is picked in the browser, so only the job's standard rate can be shown — documented in the plan. |
| DET-11 | Label for `price_override_cents` in the UI. | "Manual price override ($)" with helper text "Leave blank to bill this client's hourly rate for the scheduled time." | Its meaning is unchanged; only the fallback it overrides got smarter. |
| DET-12 | Should the 6 duplicated currency formatters (`CODEBASE-MAP.md §4`) all be consolidated? | Only in files a task already owns for another reason. `dashboard/page.tsx:82` and `invoices/page.tsx:21` are **not** in scope. | Drive-by edits inflate the review diff and add regression surface in screens this milestone doesn't otherwise change. |
| DET-13 | Does the appointments **list** now render a price? | Yes — `billed_price_cents` when non-null (marked `Invoiced`), otherwise the live derived price. | This is what D-10 exists for. It is new rendering, not just a dead-field removal, and it is why 02-02-T1 gained a `fetchClientJobRules` call on the list page. |
| DET-14 | **Answered YES and closed 2026-09-18.** Does `appointments.billed_price_cents` (and `price_override_cents`) need to be hidden from employees? | **Yes — both.** Promoted out of the details list into REQ-020 and D-21; no longer a planner default. | The planner's default had been *no*, on the grounds that employees can already read `price_override_cents` today so the kind of exposure was unchanged, and that compounding a second view rewrite onto an already-risky task is how both changes fail together. The human reversed it: the requirement is genuine confidentiality, so an exposure that already exists is a reason to close it, not to inherit it. **The risk the deferral named was real and has not gone away** — it is why `01-03` is now two sequential tasks (migration, then queries) instead of one, and why B-05 was rewritten rather than narrowed. |

---

## Blockers

| # | Blocker | Impact | Resolution |
|---|---|---|---|
| **B-01** | `public.invoice_appointments` has a `BEFORE UPDATE ... set_updated_at()` trigger (`20260427000000_schema_snapshot.sql:448`) but only `invoice_id` and `appointment_id` columns (`:234-237`). `set_updated_at()` assigns `NEW.updated_at` (`:108-115`), so **any UPDATE on that table raises `record "new" has no field "updated_at"`**. `src/types/database.ts:317-338` compounds this by typing three columns that do not exist. Latent only because `invoices.ts:378-392` deletes and re-inserts rather than updating. | REQ-006's backfill is an UPDATE on this table and would fail. | **Confirmed in scope by the human 2026-09-18.** Folded into 01-01-T1: add `created_at`, `updated_at`, `is_archived` **before** the backfill UPDATE, and correct `database.ts`. Repro: `UPDATE public.invoice_appointments SET is_archived = is_archived;` must error before the migration and succeed after. |
| ~~B-02~~ | ARCH-1/2/3 unanswered. | — | **Cleared 2026-09-18** — see D-09, D-10, D-12. |
| ~~B-03~~ | ARCH-4/6 unanswered. | — | **Cleared 2026-09-18** — see D-13, D-15. |
| **B-04** | No visibility into production data shape. Under D-09 this is now material: nobody knows how far each job's effective price moves. | The human cannot judge the reinterpretation's blast radius until it is measured. | Not blocking the build. `supabase/checks/pricing_backfill_check.sql` (REQ-002) exists precisely to produce that report, and it is read-only. **Run it against a restore of production before the human deploys.** That is a human step outside this plan. |
| **B-05** | **Rewritten 2026-09-18 for D-21's widened scope.** Under the old D-14 this was one uncertain embed (`appointments → jobs_employee_view`). Under D-21 it is a **two-level view chain** — `appointment_employees_employee_view → appointments_employee_view → jobs_employee_view` — with the `clients!inner` and `client_locations` embeds now hanging off a view instead of a base table. Any link PostgREST cannot infer breaks that screen. | **`01-03-T2` only**, and only the three `(employee)/` screens. No admin screen, no other phase, and no Block-2 task touches those files. But the blast radius *within* that scope is total: between `01-03-T1` landing and `01-03-T2` passing, the employee product does not work. | Not blocking dispatch, and deliberately **not** mitigated by guessing. `01-03-T1` (migration only) goes out immediately; `01-03-T2` is sequenced after it precisely because the embed-vs-round-trips decision is empirical — it is answered by running the query against the real views and reading PostgREST's response. `01-03-T2` carries an explicit per-file fallback (fetch ids, then fetch each view by id, stitch in JS) and its PASS requires all three screens exercised **in a browser**, with the job-site address present. Evidence the embeds may work: `appointment_employees_employee_view → appointments!inner(...)` already crosses a view boundary in this stack today (`(employee)/schedule/page.tsx:435-462`). Evidence they may not: that is view→table, and this needs table→view and view→view. |
| **B-07** | **`scripts/seed-admin-users.ts` reports success over a database it did not write to. Observed 2026-09-18.** `npm run seed:admin` printed `✅ Created test job: Standard House Cleaning` and `🎉 Test data created successfully!` and **exited 0**, while `SELECT count(*) FROM public.jobs` returned `0` and `auth.users` was empty. Mechanism: the per-user loop logs its errors and continues (`:83`, `:103`, `:118`, `:132`), `createTestData` logs and bare-`return`s (`:204`, `:235`, `:277`), the two "Skipping test data" branches (`:167`, `:178`) return silently, and `seedUsers().then(() => process.exit(0))` (`:307`) converts every one of those into a green run. Nothing reads back what it claims to have created, and nothing reports which database it resolved. | Every downstream smoke step — Phase 2's pricing walk, Phase 3's CRUD script, the employee-visibility checks in `01-03` — assumes seeded rows exist. On an empty database they all go green while proving nothing, in exactly the way the seed itself did. This is the **second** green-over-broken signal on this milestone (D-22 is the first), so it is treated as a pattern, not a coincidence. | Folded into `01-01-T2`, which already owns the file: check every insert/upsert/auth error, exit **non-zero** on any failure or skip, log the resolved database host before writing, and read back the rows it reports creating. REQ-010's acceptance and `01-01-PLAN`'s verification were rewritten so that **every seed claim is a row count queried after the run** — no exit code, no console line. Not blocking dispatch; blocking any PASS that cites `exit 0` as seed evidence. |
| **B-06** | Dropping `"Employee select assigned appointments"` (REQ-020) silently empties `"Employee select locations for assigned appointments"` (`20260427000000_schema_snapshot.sql:586-588`), whose `USING` clause subqueries `public.appointments` — a table the employee no longer passes RLS on. Employees would lose the job-site address they see today, with **no error** — just an empty embed. | Would be a silent employee-facing regression, invisible to any SQL-only check and easy to miss in a screenshot. | Folded into `01-03-T1`'s migration: a `get_employee_location_ids()` `SECURITY DEFINER` helper mirroring the existing `get_employee_appointment_ids()`, returning the identical row set. REQ-020's acceptance pins it — as the seeded employee, `GET /rest/v1/client_locations?select=*` must return the **same row set** as before the migration — and `01-03-T2`'s smoke script requires the address visible on screen. |
