# REQUIREMENTS

Legend — **P**: priority (P0 must ship, P1 should, P2 nice).
**A**: rests on an unconfirmed assumption; the referenced AS-n / DET-n in `STATE.md` decides it.

Revised 2026-09-18 against the human's ARCH-1…ARCH-6 answers. Where a requirement changed
materially, the superseded text is preserved beneath it so the amendment is auditable.

---

### REQ-001 — Every job carries exactly one hourly rate  ·  P0
`public.jobs.base_price_cents` is **renamed** to `hourly_rate_cents` with
`ALTER TABLE public.jobs RENAME COLUMN`. It stays `integer NOT NULL` and every stored value is
carried across unchanged. A named CHECK enforces `hourly_rate_cents >= 0`. A
`COMMENT ON COLUMN` records the reinterpretation, its date, and that no recalculation was applied.
There is **no `pricing_mode` column** on `jobs` or anywhere else.
`estimated_duration_minutes` is untouched and plays no part in pricing (D-18).

**Acceptance**
- `SELECT hourly_rate_cents FROM jobs` returns, row for row, the values `base_price_cents` held
  before the migration. Prove it: snapshot `SELECT id, base_price_cents FROM jobs ORDER BY id`
  before, compare after.
- `SELECT column_name FROM information_schema.columns WHERE table_name='jobs'` contains
  `hourly_rate_cents` and does **not** contain `base_price_cents` or `pricing_mode`.
- `INSERT INTO jobs (name, hourly_rate_cents) VALUES ('x', -1)` is rejected by
  `jobs_hourly_rate_cents_check`; `VALUES ('x', 0)` succeeds.
- `INSERT INTO jobs (name) VALUES ('x')` is rejected — the column is still NOT NULL.
- The migration's DOWN SQL renames the column back and has been executed once against a reset DB
  to prove it parses and succeeds.

> **Superseded (pre-2026-09-18):** "`jobs` gains `pricing_mode text NOT NULL DEFAULT 'flat'` and
> `hourly_rate_cents integer NULL`; `base_price_cents` loses its NOT NULL and becomes the flat-mode
> price." Replaced by the human's ARCH-1 answer (D-09): one rate, no mode, rename not addition.

**Depends on**: none. **Phase**: 1.

---

### REQ-002 — The price reinterpretation is reported, never corrected  ·  P0
`supabase/checks/pricing_backfill_check.sql` is a **read-only** script that makes the blast radius
of REQ-001 visible, so a human can judge it before deploying. It corrects nothing and writes
nothing.

**Acceptance**
Run via `npx supabase db query --file supabase/checks/pricing_backfill_check.sql --local`.
It emits, each under a literal label:
1. **Per job**: `id`, `name`, `hourly_rate_cents` (= the old flat per-visit price),
   `estimated_duration_minutes`, the implied new charge at that estimated duration
   (`round(hourly_rate_cents * estimated_duration_minutes / 60.0)`), and the difference.
   Jobs with a NULL estimate are listed with NULL in the derived columns, not omitted.
2. **Per un-invoiced, non-archived appointment** (`billed_price_cents IS NULL`): appointment id,
   `scheduled_date`, job name, the amount the app would have charged before
   (`COALESCE(price_override_cents, j.hourly_rate_cents)`), the amount it charges now
   (`COALESCE(price_override_cents, round(j.hourly_rate_cents * minutes / 60.0))`), and the delta —
   ordered by absolute delta descending. Plus one summary row: count affected and total delta.
3. **Invariants that must read 0**: junction rows with `billed_amount_cents IS NULL`; junction rows
   violating the both-or-neither rate/minutes rule; appointments whose `billed_price_cents`
   disagrees with their junction row's `billed_amount_cents`; appointments with a non-null
   `billed_price_cents` and no junction row; jobs with `hourly_rate_cents < 0`.

   > **Amendment 2026-09-21 (AMD-2) — normative wording for the two cache invariants.** These two
   > invariants are a single **iff**: an appointment's `billed_price_cents` is non-null **exactly
   > when** it has a junction row that still represents a live claim on it, and then it equals that
   > row's `billed_amount_cents`. Narrowing one without the other opens a hole. Which set of rows
   > counts as "a live claim" depends on AMD-1, so this requirement states both branches and the
   > executing agent applies the one the user ratified (`STATE.md` OQ-R1).
   >
   > **Branch A — AMD-1 upheld (the planner's adjudication, and the current spec).**
   > Every junction row is a live claim, whatever its invoice's status. Both invariants take
   > **no status filter and no join to `invoices`**:
   > - *appointment cache disagrees with its junction row* = `appointments` JOIN
   >   `invoice_appointments` ON `appointment_id`, counting
   >   `a.billed_price_cents IS DISTINCT FROM ia.billed_amount_cents`.
   > - *appointment cached a price with no junction row* = `appointments` WHERE
   >   `billed_price_cents IS NOT NULL` AND `NOT EXISTS` any `invoice_appointments` row for it.
   >
   > This is the wording the file carried before 2026-09-21. The narrowing added at
   > `supabase/checks/pricing_backfill_check.sql:93-94` (a join to `invoices` plus
   > `i.status <> 'void'`) was made to accommodate the unratified code change and must be
   > reverted under Branch A — see 02-03-T2.
   >
   > **Branch B — REQ-022 lands, so a released junction row is no longer a claim.
   > AMENDED 2026-09-21 (AMD-3); this is the branch now in force, delivered by `04-01-T2`.**
   > A junction row marked `is_archived = true` is a retained historical record, not a claim, and
   > **both** invariants must exclude it:
   > - *appointment cache disagrees with its **live** junction row* — `appointments` ⋈
   >   `invoice_appointments` on `appointment_id` **AND `ia.is_archived = false`**, counting
   >   `a.billed_price_cents IS DISTINCT FROM ia.billed_amount_cents`.
   > - *appointment cached a price with no **live** junction row* — `billed_price_cents IS NOT
   >   NULL` AND `NOT EXISTS` a junction row for it **with `is_archived = false`**.
   >
   > Narrowing the first alone would make an appointment that kept a stale cache through a void
   > invisible to both invariants, because the first would skip it and the second would find a
   > junction row and pass it. **They move together or not at all** (D-25).
   >
   > **There is no join to `invoices` and no `status` predicate in either branch.** The original
   > Branch B wording said "whose invoice is not `void`"; that is dropped. Under REQ-022 release is
   > the primary signal, the two predicates agree on every row the application produces going
   > forward, and they disagree only on invoices voided *before* the Phase 4 migration — which hold
   > live junction rows backed by correct caches, and which a status predicate would report as a
   > false "MUST BE 0". `is_archived` alone is correct under either answer to OQ-V1.
   >
   > **AMD-3b:** the two labels gain the word *live*, as written above. This supersedes the "labels
   > unchanged" clause below for these two invariants only: a label that still says "its junction
   > row" after the predicate has been narrowed asserts something the query no longer checks.
   >
   > Otherwise the "must be 0" contract is unchanged, the script stays a single `UNION ALL`
   > statement, and it still writes nothing.
4. **Informational**: every invoice where `invoices.total_cents <> SUM(billed_amount_cents)`,
   listed with ids and the difference. Pre-existing drift is printed, **never auto-corrected**
   (constitution §7).
- `grep -iE "^\s*(update|insert|delete|alter|drop|create)" supabase/checks/pricing_backfill_check.sql`
  returns nothing.

> **Superseded (pre-2026-09-18):** "The migration changes zero existing money values … count of
> jobs whose `base_price_cents` changed (must be 0)." Falsified by design: ARCH-1's answer
> deliberately changes every job's effective total price. The requirement became *report the
> change*, because the check that mattered — that nothing is silently corrected — still stands.

**Depends on**: REQ-001, REQ-006, REQ-018. **Phase**: 1.

---

### REQ-003 — Per-client, per-job negotiated rates persist with effective dating  ·  P0
New table `public.client_job_pricing`:
`id`, `client_id` FK→clients ON DELETE CASCADE, `job_id` FK→jobs ON DELETE CASCADE,
`hourly_rate_cents integer NOT NULL CHECK (>= 0)`, `effective_from date NOT NULL`, `notes text`,
`created_at`, `updated_at`, `is_archived boolean NOT NULL DEFAULT false`.
Unique on `(client_id, job_id, effective_from)`. Index on `(client_id, job_id, effective_from DESC)`.
No `effective_to`, **no `pricing_mode`, no `flat_price_cents`** (D-16).

**Acceptance**
- Two rows for the same client+job with different `effective_from` both persist.
- A third row duplicating an existing `(client_id, job_id, effective_from)` is rejected by
  `client_job_pricing_client_id_job_id_effective_from_key`.
- A row with `hourly_rate_cents = -1` is rejected by CHECK; `0` is accepted.
- Deleting a client cascades its pricing rows; deleting a job does likewise.
- `information_schema.columns` for this table contains no `pricing_mode` and no `flat_price_cents`.

> **Superseded (pre-2026-09-18):** the table carried `pricing_mode ('flat'|'hourly')`,
> `hourly_rate_cents`, `flat_price_cents` and a two-branch shape CHECK. Collapsed by D-16 once
> ARCH-1 removed the mode concept from `jobs`.

**Depends on**: none. **Phase**: 1.

---

### REQ-004 — One resolver decides the effective price  ·  P0
`src/lib/pricing/resolve.ts` exports a pure `resolveAppointmentPrice()` with precedence
**appointment override → client_job_pricing rule → job rate**, and a pure
`pickEffectiveRule(rules, onDate)` selecting the newest non-archived rule whose
`effective_from <= onDate`. No other module computes an effective price, and no Client Component
imports the resolver or the lookup.

**Acceptance**
- `grep -rn "base_price_cents" src/ scripts/ supabase/test-data.sql supabase/checks/` returns
  **zero matches** — the column no longer exists, so any survivor is a runtime 400.
- `grep -rn "price_override_cents ?? " src/` returns nothing.
- `grep -rln "hourlyAmountCents\|pickEffectiveRule" src/` lists only files under `src/lib/pricing/`
  (03-01-T2's list component replicates the date comparison inline by design — it must not import
  `pickEffectiveRule`).
- `grep -rln "@/lib/pricing/resolve\|@/lib/pricing/lookup" src/` lists only files that are Server
  Components or `'use server'` modules. No file containing `'use client'` appears.
- Given job rate 4500, no client rule, minutes 150, override null →
  `{ amount_cents: 11250, rate_cents: 4500, minutes: 150, source: 'job' }`.
- Given the same job plus a client rule at 3800 effective `2026-10-01`: an appointment on
  `2026-09-30` resolves from the job; on `2026-10-01` it resolves from the rule
  (`source: 'client_job_pricing'`, `amount_cents: 9500`).
- An archived rule is never selected, whatever its `effective_from`.
- A non-null `price_override_cents` wins over both and yields
  `{ amount_cents: <override>, rate_cents: null, minutes: null, source: 'appointment_override' }`.

> **Superseded (pre-2026-09-18):** the acceptance grep forbade `base_price_cents` outside a
> six-file allow-list, which directly contradicted `02-02-PLAN.md`'s instructions to write that
> identifier into files outside the list. Under REQ-001 the column does not exist at all, so the
> check is now an absolute zero-match and the contradiction is gone. `ResolvedPrice` also lost its
> `pricing_mode` field.

**Depends on**: REQ-001, REQ-003. **Phase**: 1 (module), 2 (adoption).

---

### REQ-005 — Rounding is defined, applied once, and lives in one module  ·  P0  ·  A(DET-1)
`hourlyAmountCents(rateCents, minutes) = Math.round((rateCents * minutes) / 60)` — half rounds up.
Applied per invoice line only; invoice totals are an integer sum of already-rounded line amounts.
`src/lib/pricing/money.ts` is the **only** module in the app that converts dollars↔cents or formats
currency; every previously duplicated parser and formatter in a file a task already owns is deleted
in favour of it (DET-12 bounds which files that is).

**Acceptance**
- `hourlyAmountCents(4500, 150) === 11250`
- `hourlyAmountCents(3333, 50) === 2778` (2777.5 → up)
- `hourlyAmountCents(4500, 0) === 0`
- `hourlyAmountCents(999999, 9999) === Math.round(999999 * 9999 / 60)` exactly — asserted in a test.
- **Worked example — corrected 2026-09-18.** Three invoice lines, each
  `hourlyAmountCents(6667, 30)`: every line is `Math.round(6667 * 30 / 60) = Math.round(3333.5)
  = 3334` cents, so the invoice totals `3334 * 3 = 10002` cents — **$100.02**. Rounding once over
  the unrounded sum instead would give `Math.round((6667 * 30 * 3) / 60) = Math.round(10000.5)
  = 10001` cents — **$100.01**. $100.02 is the required answer: round per line, then sum integers.
  Pinned by `tests/pricing/money.test.ts` ("an invoice total is the sum of already-rounded lines").

  > The previous text read "Three lines of $33.335 each total $100.01, not $100.005 rounded once",
  > which had the two results **swapped** — it named the round-once figure as the correct one — and
  > used dollar amounts that never occur, since a line amount is always a whole number of cents. The
  > principle it was illustrating (constitution §3) was right and is unchanged; only the arithmetic
  > was wrong. Reported by the `01-02-T1` implementer, whose tests are the reference.
- `grep -rn "Intl.NumberFormat" src/` matches only `src/lib/pricing/money.ts` and the two
  deliberately-excluded files named in DET-12 (`dashboard/page.tsx`, `invoices/page.tsx`).
- `grep -rn "parseMoneyToCents" src/` returns nothing.

**Depends on**: none. **Phase**: 1 (module), 2 (adoption).

---

### REQ-006 — Invoice lines freeze their charge on the invoice  ·  P0
`public.invoice_appointments` gains `billed_amount_cents integer NOT NULL` (after backfill),
`billed_rate_cents integer NULL`, `billed_minutes integer NULL`, with a CHECK enforcing
`(billed_rate_cents IS NULL) = (billed_minutes IS NULL)`. **There is no `billed_pricing_mode`**
(D-17): `billed_minutes IS NULL` means the line is a flat amount — a manual override or a legacy
row. The invoice builder stops writing `appointments.price_override_cents`
(`src/lib/actions/invoices.ts:185-194` is deleted). `invoices.total_cents` = SUM of line
`billed_amount_cents`.

**Acceptance**
- Creating an invoice over 2 appointments writes 2 junction rows each with a non-null
  `billed_amount_cents`, and `invoices.total_cents` equals their sum.
- After creating that invoice, both appointments' `price_override_cents` are **identical** to a
  before-snapshot.
- Raising a job's `hourly_rate_cents` after an invoice is issued changes neither that invoice's
  `total_cents` nor any `billed_amount_cents`, and the invoice detail page still shows the original
  figures.
- Legacy junction rows backfill to
  `billed_amount_cents = COALESCE(a.price_override_cents, j.hourly_rate_cents, 0)`,
  `billed_rate_cents = NULL`, `billed_minutes = NULL`. Because the rename preserved every number,
  this is the exact amount the app charged before the migration — constitution §7 applies here in
  full and no legacy amount may move.
- `grep -n "price_override_cents" src/lib/actions/invoices.ts` shows reads only, no `.update(`.

**Depends on**: REQ-001. **Phase**: 1 (schema + backfill), 2 (code adoption).

---

### REQ-007 — `invoice_appointments` UPDATE stops failing  ·  P0
The table has a `BEFORE UPDATE ... set_updated_at()` trigger
(`20260427000000_schema_snapshot.sql:448`) but no `updated_at` column (`:234-237`), so **every
UPDATE on it raises `record "new" has no field "updated_at"`**. The migration adds `created_at`,
`updated_at`, `is_archived` **before** the backfill UPDATE.

**Acceptance**
- On a freshly reset DB, `UPDATE public.invoice_appointments SET is_archived = is_archived;`
  completes without error. On a DB reset to `7ae55f5` it errors. Both directions demonstrated.
- `src/types/database.ts:317-338` now matches the real columns (drift closed, not extended).

**Depends on**: none. **Phase**: 1.

---

### REQ-008 — Negotiated rates are admin-only  ·  P0
`client_job_pricing` has RLS enabled, a `"Admin full access on client_job_pricing"` policy matching
the existing naming/shape, and **no employee policy and no anon policy**.

**Acceptance**
- Signed in as a seeded employee, a PostgREST `select` on `client_job_pricing` returns zero rows.
- Signed in as the seeded admin, the same select returns rows.
- `SELECT policyname FROM pg_policies WHERE tablename='client_job_pricing'` returns exactly one row.

**Depends on**: REQ-003. **Phase**: 1.

---

### REQ-009 — `src/types/database.ts` matches the schema  ·  P0
Every column added, renamed or widened has its matching hand edit in `Row`, `Insert` and `Update`,
typed to the real nullability. `client_job_pricing` is added as a new table entry;
`jobs_employee_view` is added as a new `Views` entry.

**Acceptance**
- `jobs.hourly_rate_cents` is `number` (NOT NULL) and `jobs.base_price_cents` is absent from the
  file entirely.
- `jobs.description` and `jobs.estimated_duration_minutes` are corrected to `| null`
  (pre-existing drift, `CODEBASE-MAP.md §6`), since the same block is being edited anyway.
- `appointments.billed_price_cents` is `number | null`.
- `invoice_appointments` types `billed_amount_cents: number`, `billed_rate_cents: number | null`,
  `billed_minutes: number | null`, plus the three housekeeping columns that now genuinely exist.
- `client_job_pricing` and `jobs_employee_view` entries exist and match their DDL exactly.
- **Corrected 2026-09-18:** `npx tsc --noEmit` is clean at the end of Phase 1 **and** at the end of
  Phase 2. The previous text ("at the end of Phase 1 it is not, by design (D-19)") was wrong — see
  REQ-017. Note that a clean `tsc` here is a weak signal: the clients are untyped, so `database.ts`
  being right is checked by reading it against the DDL, not by the compiler. `01-01-T1` also had to
  add `Relationships` and `Functions` members to make `Database` satisfy postgrest-js's
  `GenericSchema`; without them `Schema` resolves to `never` and `from(...).select(...)` returns
  `never` rows.

**Depends on**: REQ-001, REQ-003, REQ-006, REQ-007, REQ-018 — all delivered by the same task
(01-01-T1), so this is an internal ordering, not a cross-task wait. The `jobs_employee_view` type
entry is written here from the column list frozen in `01-CONTEXT.md`; it does **not** wait on
REQ-019's migration, and REQ-019 does not wait on this. **Phase**: 1.

---

### REQ-010 — Local setup and seeds still work  ·  P0
`supabase/seed.sql`, `supabase/test-data.sql` and `scripts/seed-admin-users.ts` run clean against
the migrated schema and seed the new paths so they are exercised by default.

**Acceptance — amended 2026-09-18 (B-07). Every claim below is a row count queried against the
database after the run. An exit code and a console line are not evidence: `npm run seed:admin`
printed `✅ Created test job` and `🎉 Test data created successfully!` and exited 0 while
`SELECT count(*) FROM jobs` returned 0 and `auth.users` was empty.**
- After `supabase db reset` → `npm run seed:admin` →
  `npx supabase db query --file supabase/test-data.sql --local`, queried against that same local
  database: `SELECT count(*) FROM auth.users` ≥ 3; `SELECT count(*) FROM public.employees` ≥ 2;
  `SELECT count(*) FROM public.clients WHERE name = 'Johnson Family'` = 1;
  `SELECT count(*) FROM public.jobs WHERE hourly_rate_cents > 0` ≥ 2;
  `SELECT count(*) FROM public.client_job_pricing` ≥ 1;
  `SELECT count(*) FROM public.appointments` ≥ 1.
- The same sequence run a **second** time back to back yields **identical** counts (idempotent
  today and must stay so).
- `scripts/seed-admin-users.ts` **exits non-zero** when any insert, upsert or user creation fails,
  and when it takes either "skipping test data" branch. Demonstrated by forcing one failure, not
  asserted from reading the code.
- No seed file contains the string `base_price_cents` or `pricing_mode`.
- Seeded rates are plausible hourly figures, not repurposed per-visit totals (D-20): the seeded
  09:00–11:00 appointment on `Standard House Cleaning` derives
  `round(4500 * 120 / 60) = 9000` cents.

**Depends on**: REQ-001, REQ-003. **Phase**: 1.

---

### REQ-011 — Money math has regression tests  ·  P0
`npm test` runs `node --test "tests/**/*.test.ts"` with no new dependency. Tests cover `money.ts`
and `resolve.ts`.

**Acceptance**
- `npm test` passes and reports ≥ 20 assertions.
- Cases required: every bullet under REQ-004 and REQ-005; `parseDollarsToCents` on
  `''`, `'0'`, `'12'`, `'12.5'`, `'12.345'`, `'-1'`, `'abc'`, `'1e3'`;
  `durationMinutes('09:00','11:30') === 150` and `durationMinutes('09:00:00','11:30:00') === 150`;
  `pickEffectiveRule` with no rules, one future rule, two past rules, and an archived newest rule.
- `npm run build` still succeeds with `tests/` present (verified at the Phase 2 gate).

**Depends on**: REQ-004, REQ-005. **Phase**: 1.

---

### REQ-012 — Admins can set a job's hourly rate from the UI  ·  P1
`src/components/admin/job-form.tsx` offers one `Hourly Rate ($/hour)` field;
`src/lib/actions/jobs.ts` validates and persists it; `src/components/admin/jobs-list.tsx` shows
`$45.00/h`. There is no mode selector anywhere, because there are no modes.

**Acceptance**
- Creating a job at `45` persists `hourly_rate_cents = 4500`.
- Submitting an empty rate re-renders with `fieldErrors.hourly_rate_cents` set and writes nothing.
- Submitting `-5` re-renders with the same field error.
- The jobs list shows `$45.00/h`.
- The `estimated_duration_minutes` helper text states that it is a scheduling estimate and does
  **not** affect price.
- The form is usable at 400px width and matches the surrounding emerald/neutral styling.

> **Superseded (pre-2026-09-18):** required a `pricing_mode` select, a flat-price field, an
> hourly-rate field, and mode-switch clearing behaviour. All of that is deleted by D-09.

**Depends on**: REQ-001, REQ-009. **Phase**: 2.

---

### REQ-013 — Appointments and invoices show the right number  ·  P0
Every read of `price_override_cents ?? base_price_cents` is replaced. The rule everywhere is:
**if `appointments.billed_price_cents` is non-null, show that (the appointment is invoiced and the
amount is frozen); otherwise show the resolver's live result.** Hourly figures display their
breakdown (`$45.00/h × 2h 30m = $112.50`). Affected: `src/lib/actions/invoices.ts:139,182-196`;
`invoices/[id]/page.tsx:128`; `appointments/[id]/page.tsx:125`; `appointments/page.tsx:91,99`;
`invoice-form.tsx:65,296`; `appointment-form.tsx:197`.

**Acceptance**
- The appointment detail page for an un-invoiced appointment on an hourly job shows the amount, the
  rate × duration breakdown, and a source label (`Manual override` / `Client rate` / `Standard rate`).
- Once that appointment is invoiced, the same page shows `billed_price_cents` with an `Invoiced`
  label and no live recomputation.
- The appointments **list** shows a per-row amount: the billed figure marked `Invoiced` when set,
  otherwise the derived figure (DET-13). Two appointments of the same job with different scheduled
  durations show different amounts.
- The invoice builder pre-fills each line from the resolved amount and shows the rate breakdown in
  place of the old `Base:` hint.
- The issued-invoice detail page renders the **frozen** `billed_*` values, never a recomputation.
  Legacy lines (`billed_minutes IS NULL`) render the amount alone with no breakdown and no error.
- `src/components/admin/appointments-types.ts` and
  `src/components/admin/new-appointment-schedule-context.tsx` no longer carry a job price field
  they never render.

**Depends on**: REQ-004, REQ-006, REQ-009, REQ-018. **Phase**: 2.

---

### REQ-014 — Recurring regeneration re-resolves rather than copies  ·  P1  ·  A(DET-2)
`src/lib/actions/appointments.ts:847` currently copies the source occurrence's
`price_override_cents` onto every regenerated future occurrence. Regenerated occurrences are created
with `price_override_cents = NULL` and `billed_price_cents = NULL`, so they price from the client
rule or the job rate.

**Acceptance**
- Editing a recurring appointment with scope `future`, where the source occurrence has a manual
  override, produces future rows with `price_override_cents IS NULL` and `billed_price_cents IS NULL`.
- Those future rows resolve to the client rule when one exists, otherwise the job rate.
- Initial recurring-series generation (`appointments.ts:523-534`) still carries the override the
  admin typed in that same submission — unchanged.

**Depends on**: REQ-004. **Phase**: 2.

---

### REQ-015 — Admins can manage per-client job pricing  ·  P0
CRUD for `client_job_pricing` under `/solutions/clients/[id]/pricing`, reachable from the client
detail page, following the existing clients/locations CRUD shape. One amount field
(`hourly_rate_cents`), no mode selector (D-16).

**Acceptance**
- From a client detail page an admin can add a rule (job, rate, effective-from, notes), edit it,
  archive it, and restore it.
- The list groups rules by job, newest `effective_from` first, and marks exactly one row per job as
  `Current` for today, with `Scheduled` / `Superseded` / `Archived` for the others.
- Adding a duplicate `(job, effective_from)` returns a field error, not a 500.
- An employee navigating to the route is redirected by the `(admin)` layout gate.

**Depends on**: REQ-003, REQ-008, REQ-009. **Phase**: 3.

---

### REQ-016 — Nothing is deployed or committed  ·  P0
No task runs `supabase db push`/`link`; no task runs `git commit`/`git push`.

**Acceptance**
- `git log -1` still reports `7ae55f5` when the milestone closes.
- Migrations exist only under `supabase/migrations/`.

**Depends on**: none. **Phase**: all.

---

### REQ-017 — The rename sweep has no compiler safety net; its breakage is runtime-only  ·  P0
*(new 2026-09-18; **rewritten 2026-09-18** on `01-01-T1`'s verified evidence)*

Renaming `jobs.base_price_cents` → `hourly_rate_cents` produces **zero TypeScript errors**. No
Supabase client in this app is parameterized with the `Database` generic: `createAdminClient()`
(`src/lib/supabase/admin.ts:6`) and `createClient()` (`src/lib/supabase/server.ts:6`) both call the
factory with no generic, so both are `SupabaseClient<any>`. Every one of the 57 `base_price_cents`
sites is either a read through an untyped client into a hand-declared local row type, or a string
literal inside a `.select(...)`. With the rename landed, `npx tsc --noEmit` returns **exit 0,
clean**.

The breakage is real and lands entirely at **runtime**, as PostgREST `42703` errors. Demonstrated
against local PostgREST as admin:

```
400 jobs?select=id,name,base_price_cents
    {"code":"42703","message":"column jobs.base_price_cents does not exist"}
400 appointments?select=id,jobs!inner(id,name,base_price_cents)
    {"code":"42703","message":"column jobs_1.base_price_cents does not exist"}
```

**Consequence for Phase 2 — this is the requirement.** There is no compiler to enumerate the work
and no build failure to catch a miss. The 21-file table in `01-RESEARCH.md §10` must be worked
through **by grep, file by file**; a missed site is a silent runtime 400 on a real page that `tsc`,
`npm run lint` and `npm run build` all pass straight over.

**Acceptance**
- `npx tsc --noEmit` is **clean at the end of Phase 1 and at the end of Phase 2**. There is no
  expected-noise allowance anywhere in this milestone: any `tsc` error at any gate is a real defect
  and fails that phase. (It was clean before `01-01-T1` except the two `src/lib/pricing/lookup.ts`
  errors that task cleared, and it is clean after.)
- `npm run build` succeeds at the Phase 2 gate.
- The objective check on the sweep is REQ-004's grep —
  `grep -rn base_price_cents src/ scripts/ supabase/test-data.sql supabase/checks/` returns zero —
  and REQ-017 deliberately does not restate a second, weaker one.
- Every row of `01-RESEARCH.md §10`'s 21-file table is accounted for at the Phase 2 gate: each file
  has either been edited by its owning task, or is
  `supabase/migrations/20260427000000_schema_snapshot.sql`, a landed migration nobody edits.
- **REQ-021 is met.** A zero grep proves the string is gone; only loading the page proves the query
  still works. Exit codes and clean greps are not sufficient evidence on this milestone.

> **Superseded (pre-2026-09-18 rewrite):** "After Phase 1, `npx tsc --noEmit` fails, and every
> reported file path is one of exactly these eight … Every reported error names `base_price_cents`
> or a type derived from it." That requirement was **vacuous — it could be neither satisfied nor
> falsified**, because the rename produces no type error at all. `01-01-T1` landed the rename and
> `tsc` came back clean, which under the old text is indistinguishable from the rename never having
> happened. The premise it rested on (D-19, constitution §16) was wrong about the mechanism, not
> just the count.

**Depends on**: REQ-001. **Phase**: 1 (established), 2 (swept and proven).

---

### REQ-021 — Every page that read a renamed column is loaded in a browser  ·  P0  *(new 2026-09-18)*
Because the rename's failure mode is a PostgREST 400 that every static check passes over
(REQ-017, D-22), Phase 2 cannot pass on greps and exit codes. Every route that read
`base_price_cents` at `7ae55f5` is exercised in a real browser against a reset + seeded local
stack, with the devtools network panel and the Next server log both watched.

The routes, derived from `01-RESEARCH.md §10`:
- `/solutions/jobs`, `/solutions/jobs/new`, `/solutions/jobs/<id>/edit` — 02-01-T1, 02-01-T2
- `/solutions/appointments`, `/solutions/appointments/new`, `/solutions/appointments/<id>`,
  `/solutions/appointments/<id>/edit` — 02-02-T1
- `/solutions/invoices/new`, `/solutions/invoices/<id>`, `/solutions/invoices/<id>/edit` — 02-02-T2

The three `(employee)/` screens are covered separately and to the same standard by REQ-019 /
REQ-020, whose acceptance already requires a browser.

**Acceptance**
- Each of the ten routes renders its intended content — not an error boundary, and not an empty
  list or a blank amount where seeded rows exist.
- **Zero `/rest/v1/` responses with status ≥ 400** across the whole walk. A `42703` anywhere is an
  automatic FAIL, whatever the greps say.
- The Next server log shows no `column ... does not exist` for the duration of the walk.
- Every page that should display money displays a number; `$0.00` or a blank standing in for a
  failed fetch is a FAIL.
- The verification report records this per route (route → rendered OK / worst observed
  `/rest/v1/` status). A Phase 2 report citing only exit codes and greps does not satisfy REQ-021.

**Depends on**: REQ-012, REQ-013. **Phase**: 2 (gate).

---

### REQ-018 — An invoiced appointment carries its billed amount  ·  P0  *(new 2026-09-18, ARCH-2)*
`public.appointments` gains `billed_price_cents integer NULL` — a denormalized read-only copy of
that appointment's `invoice_appointments.billed_amount_cents`. NULL means "not invoiced; use the
live derived price". It is **never** an input to `resolveAppointmentPrice` and never pre-fills the
override field. `appointments.price_override_cents` keeps its present meaning, unchanged (D-11).

**Write path — this is the whole contract:**
- Written only by `createInvoice` and `updateInvoice` in `src/lib/actions/invoices.ts`, in the same
  action that writes the junction rows, immediately after the junction insert succeeds. Bounded to
  that one invoice's lines — N appointments for an N-line invoice. **Not** a fan-out: nothing
  recomputes it when a job rate or a client rule changes.
- `updateInvoice` deletes and re-inserts its links; appointments present in the *previous* link set
  but absent from the new selection are set back to NULL. The previous set is already fetched and
  currently unused at `src/lib/actions/invoices.ts:347`.
- `issueInvoice` / `markInvoicePaid` / `voidInvoice` / `archiveInvoice` / `restoreInvoice` write it
  **never**. Only draft invoices are editable (`invoices.ts:343-345`), so the value stops moving at
  issue on its own. A voided invoice keeps its links and therefore keeps the frozen amount — the
  appointment is still spoken for and cannot be invoiced again until the link is removed.

  > **Amendment 2026-09-21 (AMD-1) — challenged, adjudicated, UPHELD. Not yet ratified by the
  > user; see `STATE.md` OQ-R1.** During Phase 2 review it was argued that `voidInvoice` must
  > clear `billed_price_cents`, because a void invoice is not a bill and the appointment should
  > return to its live derived price. That argument is right about the money and wrong about this
  > system, so the clause above **stands unchanged in substance**. The one word of it that was
  > wrong is corrected here: "**until the link is removed**" implies a removal path that does not
  > exist. Under the schema as it stands there is none —
  > `invoice_appointments_appointment_id_key UNIQUE (appointment_id)`
  > (`supabase/migrations/20260427000000_schema_snapshot.sql:352`) is global and status-blind;
  > both invoice builders exclude an appointment that has *any* junction row, with no status
  > filter (`invoices/new/page.tsx:70,88-90`; `invoices/[id]/edit/page.tsx:84,117-121`); only
  > `draft` invoices are editable (`invoices.ts:343-345`), `void` is terminal, and there is no
  > `deleteInvoice`. An appointment on a voided invoice is therefore **permanently unbillable**,
  > and has been since before this milestone.
  >
  > Clearing the cache alone changes only what the screen says, not what the system will do: the
  > appointment would render exactly like an ordinary un-invoiced visit — live price, no
  > "Invoiced" chip (`appointments/page.tsx:128-129`, `appointments-list.tsx:125-129`,
  > `appointments/[id]/page.tsx:146-155`) — while still never appearing in the builder, and while
  > `createInvoice`'s insert would still fail the UNIQUE with the generic duplicate-appointment
  > error. That is a false affordance with no visible cause. With the cache left populated, both
  > signals agree and both are true: this visit is spoken for by an invoice record that still
  > exists. No money is misstated either way — every revenue figure reads `invoices.total_cents`
  > (`invoices/page.tsx:114,165`, `dashboard/page.tsx:84,282`); nothing aggregates
  > `appointments.billed_price_cents`.
  >
  > The real defect the review found is larger than a cache write and is **pre-existing**: voiding
  > an invoice permanently consumes its appointments. It is carried as **REQ-022** and must be
  > fixed whole or not at all. Until REQ-022 lands, `voidInvoice` writes `billed_price_cents`
  > never.
  >
  > > **AMD-4, 2026-09-21 — the sentence above has expired.** REQ-022 is scheduled as **Phase 4**
  > > (GitHub issue #18). From `04-02-T1` onward, `voidInvoice` **does** clear
  > > `billed_price_cents`, for exactly the appointments whose junction rows it just released, and
  > > only after the status write and the release write have both succeeded (REQ-022(d)). D-23 is
  > > not overturned — its premise (the appointment stays unbillable) is removed. See the split
  > > acceptance bullet below.
- Backfill: after the junction backfill, `UPDATE appointments a SET billed_price_cents =
  ia.billed_amount_cents FROM invoice_appointments ia WHERE ia.appointment_id = a.id`.

**Acceptance**
- A fresh appointment has `billed_price_cents IS NULL` and its pages show the derived price.
- After it is added to an invoice, `billed_price_cents` equals that line's `billed_amount_cents`.
- Overtyping the line in the draft builder and saving updates both, still equal.
- Removing it from the draft invoice sets `billed_price_cents` back to NULL and the appointment
  reverts to showing the derived price.
- **Split by AMD-4, 2026-09-21.** **Issuing, archiving or restoring** the invoice leaves
  `billed_price_cents` untouched — unchanged, still in force, and still a hard boundary (D-24: an
  archived *paid* invoice is money the client really was charged). **Voiding** now clears it, for
  exactly the appointments the void releases (REQ-022(d), Phase 4, `04-02-T1`).
  > **Superseded text, kept for audit:** *"Issuing, voiding, archiving or restoring the invoice
  > leaves `billed_price_cents` untouched. **Upheld 2026-09-21 (AMD-1)** against the Phase 2
  > review's challenge, and **ratified by the user the same day (OQ-R1 option (a))** — see the
  > amendment note above and REQ-022. The violating code at `src/lib/actions/invoices.ts` (formerly
  > `:632-641`) **has been reverted (02-03-T1)** and the matching check-script narrowing undone
  > (02-03-T2); `voidInvoice` now writes only the status. **This acceptance criterion is
  > satisfied.**"* That was correct for Phases 1–3 and is the baseline `04-02-T1` starts from. It is
  > superseded only on the `voidInvoice` clause, and only because REQ-022 now lands alongside it —
  > which is the precondition OQ-R1 option (c) named.
- Changing the job's `hourly_rate_cents` afterwards leaves it untouched.
- `grep -rn "billed_price_cents" src/lib/pricing/` returns nothing — the resolver never sees it.
- The check script's reconciliation invariants (REQ-002 item 3) report 0.

**Depends on**: REQ-006. **Phase**: 1 (column + backfill), 2 (write path).

---

### REQ-019 — Employees cannot read any rate  ·  P0  *(new 2026-09-18, ARCH-5)*
`"Employee select jobs"` (`20260427000000_schema_snapshot.sql:582`) is dropped. A
`security_invoker=false` view `public.jobs_employee_view` exposes `id, name, description,
is_archived` only, carries the dropped policy's row filter (`NOT is_archived`) in its own body, and
is `REVOKE ALL` + `GRANT SELECT TO authenticated, service_role` so the definer view is not
writable. The three employee-facing queries embed through it.

This is a **deliberate behaviour change**: employees can read job prices today and will not be able
to after this milestone.

**Acceptance**
- Signed in as a seeded employee, `select=*` on `jobs` through PostgREST returns zero rows /
  permission denied; the same on `jobs_employee_view` returns non-archived jobs with no rate column.
- Signed in as the seeded admin, `select` on `jobs` still returns every column.
- `SELECT policyname FROM pg_policies WHERE tablename='jobs'` returns only the admin policy.
- An employee `INSERT`/`UPDATE`/`DELETE` against `jobs_employee_view` is refused (no grant).
- `/solutions/schedule`, `/solutions/schedule/<id>` and `/solutions/time-sheets` all render for a
  seeded employee with the job name and description present and no console/network error — this is
  the regression that matters most (B-05).
- No admin screen changes behaviour.

**Depends on**: REQ-001. **Phase**: 1.
**Note (2026-09-18):** REQ-019 is unchanged in substance, but it is no longer the whole of ARCH-5 —
the human's revised answer, option (b), adds REQ-020. The two now share one migration (Migration B,
`01-03-T1`) and one set of query rewrites (`01-03-T2`), and neither can PASS alone.

---

### REQ-020 — Employees cannot read any appointment price  ·  P0  *(new 2026-09-18, ARCH-5 = (b))*
The human's revised ARCH-5 answer is **full confidentiality**: what a client is billed and what an
employee is paid are two entirely separate numbers, and the pay side (#11's employee↔job pay-rate
table) does not exist. Employees therefore get **zero** visibility into what the client is charged,
including on appointments they are assigned to.

`"Employee select assigned appointments"` (`20260427000000_schema_snapshot.sql:574`) is dropped —
it is row-level and so cannot mask a column, whatever the employee-facing query selects. It is
replaced by a `security_invoker=false` view `public.appointments_employee_view` that carries the
dropped policy's row filter in its own body, lists its thirteen columns **explicitly** (never
`SELECT *`, or `billed_price_cents` is inherited the moment REQ-018 adds it), and is `REVOKE ALL` +
`GRANT SELECT TO authenticated, service_role`. `price_override_cents` and `billed_price_cents` are
the two columns it does not expose. Every employee-reachable read of `appointments` goes through it
(the complete audit is `01-RESEARCH.md §12`; it is the same three route files REQ-019 touches).

**Nothing replaces the hidden price in the employee UI.** No placeholder, no estimated earnings, no
"pay TBD". There is nothing to show until #11 exists, and #11 is out of scope (constitution §17).

**`"Employee select locations for assigned appointments"`** (`:586-588`) is repaired in the same
migration. Its `USING` clause subqueries `public.appointments`, whose RLS the employee no longer
passes, so dropping the appointments policy would silently empty it and employees would lose the
job-site address they see today. The repair is a `get_employee_location_ids()` `SECURITY DEFINER`
helper mirroring the existing `get_employee_appointment_ids()`, returning the identical row set.

**Acceptance** — the objective checks are at the PostgREST layer, not in the UI. No employee screen
renders a price *today*, so "the UI stopped showing it" proves nothing.
- Authenticated as a seeded employee, against an appointment **that employee is assigned to**:
  `GET /rest/v1/appointments?select=price_override_cents&id=eq.<assigned id>` returns **zero rows**,
  and so does the same call for `billed_price_cents`. Proving it on an unassigned appointment proves
  nothing — that was already blocked.
- `GET /rest/v1/appointments?select=*` as that employee returns zero rows.
- `GET /rest/v1/appointments_employee_view?select=*` as that employee returns exactly their assigned
  appointments, and the JSON payload contains neither a `price_override_cents` key nor a
  `billed_price_cents` key.
- `SELECT policyname FROM pg_policies WHERE tablename='appointments'` returns exactly one row, the
  admin policy.
- An employee `INSERT`/`UPDATE`/`DELETE` against `appointments_employee_view` is refused, and the
  base row is unchanged afterwards.
- `information_schema.role_table_grants` for `appointments_employee_view` shows `SELECT` only, for
  `authenticated` and `service_role` only.
- As that employee, `GET /rest/v1/client_locations?select=*` returns the **same row set** as before
  the migration — the `client_locations` repair.
- As the seeded admin, `GET /rest/v1/appointments?select=*` still returns both price columns and no
  admin screen changes behaviour.
- `grep -rn "price_override_cents\|billed_price_cents\|hourly_rate_cents" "src/app/(internal)/solutions/(employee)/"`
  returns zero matches, and
  `grep -rn "appointments!inner\|jobs!inner" "src/app/(internal)/solutions/(employee)/"` likewise.
- All three employee screens render in a browser for a seeded employee with **the location address
  present**, and `/solutions/schedule/<an unassigned appointment id>` still 404s.

**Depends on**: none at work time (the view names its columns explicitly, so Migration B applies with
or without Migration A). Ordered after REQ-018 only in the sense that once `billed_price_cents`
exists it must already be excluded. **Phase**: 1.

> **Supersedes DET-14**, which recorded this exposure as accepted-and-deferred with the reasoning
> "compounding it onto an already-risky task is how both changes fail together". The human reversed
> that on 2026-09-18. The risk it named was real and has not gone away, which is why `01-03` is now
> two sequential tasks rather than one.

---

### REQ-022 — Voiding an invoice releases its appointments  ·  P1  ·  *(new 2026-09-21, AMD-1; **SCHEDULED — Phase 4**)*

**Status, updated 2026-09-21 (second revision): SCHEDULED.** The user filed this as GitHub issue
**#18** and has now scheduled it. It is **Phase 4**, delivered by
`phases/04-void-releases-appointments/04-01-PLAN.md` (T1 migration + `database.ts`, T2 check
script) and `04-02-PLAN.md` (T1 `voidInvoice`, T2 both builders). All four tasks are dispatchable
immediately and concurrently; see `ROADMAP.md`.

> **Superseded status line (2026-09-21, first revision), kept for audit:** *"OQ-R1 is resolved —
> the user ratified option (a), so `voidInvoice` does NOT clear the cache and the half-fix that had
> shipped was reverted (`02-03-PLAN`). The user has separately ruled on REQ-022 itself: DEFER. It
> is to be filed as its own GitHub issue (the user is filing it; no agent should create it) and is
> explicitly NOT scheduled in this milestone. No task implements it."* The OQ-R1 half of that
> statement still stands and is what `04-02-T1` starts from: the tree is at the clean pre-REQ-022
> baseline, `voidInvoice` writing only the status. Only the DEFER half is reversed.
>
> **D-23 is not overturned by this.** D-23 held that `voidInvoice` must not clear the cache *while
> the appointment remains unbillable*. Phase 4 removes that premise. D-24 (archive/restore never
> write the cache) survives unchanged and is a hard boundary on `04-02-T1`.

> **Issue #18's phrasing, reconciled (2026-09-21).** #18 asks to *"scope the unique constraint on
> `invoice_appointments.appointment_id` to non-void invoices (partial unique index)"*. That is not
> expressible: a partial index predicate cannot read another table, and `invoice_appointments` has
> no status column. **Clause (b) below is the technically correct reading and is confirmed.** The
> issue's intent is satisfied through the `is_archived` release marker rather than through an
> invoice-status predicate — which is equivalent in behaviour precisely because `voidInvoice` is
> the only thing that sets the marker. See `phases/04-void-releases-appointments/04-CONTEXT.md §2`.

**It must still be built whole or not at all** — the partial unique index, both invoice-builder
filters, the action change and the check-script narrowing land together, or the result is a visit
that looks billable and is not.

Voiding an invoice today permanently consumes every appointment on it. The cause is three
pre-existing facts acting together, none of them introduced by this milestone:

1. `invoice_appointments_appointment_id_key UNIQUE (appointment_id)`
   (`20260427000000_schema_snapshot.sql:352`) is global and status-blind — an appointment may be
   linked to at most one invoice, ever.
2. Both invoice builders filter candidates on "has any junction row", with no status filter
   (`invoices/new/page.tsx:70,88-90`; `invoices/[id]/edit/page.tsx:84,117-121`).
3. `void` is terminal, only `draft` invoices are editable (`invoices.ts:343-345`), and no action
   deletes an invoice — so the link can never be released.

Net effect: a visit that was invoiced, disputed and voided can never be billed again through the
UI. The correct behaviour is that voiding an invoice returns its appointments to the billable pool
**and** to their live derived price.

**This is all-or-nothing.** Any proper subset makes the product worse than leaving it alone,
because it breaks the agreement between what the appointment shows and what the system will let
the admin do. The four parts:

- **(a) A release marker on the junction row, not a deletion.** `invoice_appointments.is_archived`
  already exists (added by `20260918120000`, currently written and read by nothing) and is exactly
  this. `voidInvoice` sets `is_archived = true` on its own junction rows. The rows are **retained
  in full** — amount, rate, minutes — so constitution §7 is satisfied and the record of what was
  voided survives.
- **(b) Uniqueness narrowed to live claims.** Drop the table-wide
  `invoice_appointments_appointment_id_key` and replace it with
  `CREATE UNIQUE INDEX ... ON invoice_appointments (appointment_id) WHERE is_archived = false;`
  in one additive-or-widening migration with verified DOWN SQL (constitution §4). It must be a
  partial index on `is_archived`, **not** on invoice status: a partial index cannot read another
  table, and `invoice_appointments` has no status column. The composite PK
  `(invoice_id, appointment_id)` still prevents a duplicate line within one invoice.
- **(c) Both builders ignore released links.** The "already invoiced" sets in
  `invoices/new/page.tsx` and `invoices/[id]/edit/page.tsx` filter
  `is_archived = false`, so a released appointment is offered again.
- **(d) The cache follows the claim.** `voidInvoice` clears `billed_price_cents` for the
  appointments it just released, in the same action, after the status write and the release write
  both succeed. `archiveInvoice` / `restoreInvoice` still write it **never** — archival is a
  visibility flag, an archived *paid* invoice is still money that was billed, and clearing there
  would show a price the client was in fact charged as though it had never been charged.

**Acceptance** *(sharpened into checkable form 2026-09-21 when the requirement was scheduled; the
substance of every bullet is unchanged except where AMD-3 is marked)*

*Schema — `04-01-T1`:*
- `SELECT count(*) FROM pg_constraint WHERE conname = 'invoice_appointments_appointment_id_key'`
  returns **0**, and `pg_indexes` shows exactly one
  `invoice_appointments_live_appointment_id_idx` whose `indexdef` contains
  `WHERE (is_archived = false)`.
- Two junction rows for one `appointment_id`, both with `is_archived = false`, are rejected with
  SQLSTATE **23505**. With the first row's `is_archived` set to `true` first, both persist and
  `count(*) … WHERE appointment_id = '<id>'` returns **2**.
- `invoice_appointments_pkey` (`invoice_id, appointment_id`) is untouched and still rejects a
  duplicate line within one invoice.
- `SELECT count(*) FROM invoice_appointments WHERE is_archived = true` is **0** immediately after
  `supabase db reset` — the migration runs no backfill (see OQ-V1 in `04-CONTEXT.md §6`).
- `src/types/database.ts` carries the change in the same task (constitution §9): the
  `invoice_appointments_appointment_id_fkey` relationship becomes `isOneToOne: false`.

*Behaviour — `04-02-T1`, `04-02-T2`:*
- Issue an invoice over an appointment, void it: the appointment appears in the new-invoice
  builder again, shows its live derived price, and shows no "Invoiced" chip.
- Invoicing it again succeeds: a second `invoice_appointments` row is created and the unique rule
  does not fire, with no "already attached to another invoice" error.
- An appointment held by a **live** junction row is still excluded from both builders, and a
  hand-crafted attempt to invoice it still surfaces `duplicateAppointmentError`. The relaxation
  must not remove the double-billing guard.
- The voided invoice's own row and junction rows still exist with their original
  `billed_amount_cents`, `billed_rate_cents`, `billed_minutes`, and its `total_cents` is unchanged.
- The voided invoice's detail page still renders its original lines, their rate × minutes
  breakdown, and its total.
- `archiveInvoice` and `restoreInvoice` leave every `billed_price_cents` untouched and every
  junction row's `is_archived` untouched — on a void invoice **and** on a paid one (D-24).
- Voiding a draft invoice with no lines succeeds; voiding a paid invoice is still refused.

*Reporting — `04-01-T2`:*
- `pricing_backfill_check.sql` §3 reads 0 throughout, run **after** a void has left a released row
  in the database, with both cache invariants narrowed **together** (D-25).
  > **AMD-3, 2026-09-21 — this bullet's predicate is narrowed.** It previously read: *"…written per
  > REQ-002 **Branch B** — additionally excluding released (`is_archived = true`) junction rows
  > from 'a live junction row', not only void ones, since (a) makes release the primary signal."*
  > Read literally that is two predicates: not released **and** not on a void invoice. **The
  > invoice-status predicate is dropped; `invoice_appointments.is_archived = false` alone defines a
  > live junction row.** Reason: the two are equivalent for every row this application produces
  > going forward, but *not* for invoices voided before Phase 4 — those hold live junction rows
  > with correct, populated caches, which a status predicate would report as a false "MUST BE 0"
  > alarm (the first invariant skips them on status while the second finds no "live" row). The
  > `is_archived`-only wording is correct under either answer to OQ-V1 and is the honest statement
  > of what the system now means by "spoken for". **REQ-002's Branch B is amended to match**; see
  > there.
  > **AMD-3b:** both invariant labels gain the word *live*, against REQ-002 Branch B's "labels
  > unchanged" clause. A label reading "its junction row" after the predicate has been narrowed
  > asserts something the query no longer checks, and a human reads this file for a number that
  > must be 0.

**Depends on**: REQ-018 (the cache exists), REQ-006 (the frozen line exists). Both shipped in
Phases 1–2. **Phase**: **4** — scheduled 2026-09-21 as GitHub issue #18.

**Rests on an assumption**: OQ-V1 (`04-CONTEXT.md §6`). The forward-only default means invoices
voided *before* the Phase 4 migration keep their appointments consumed. If the user rules that they
must be released too, `04-01-T1` gains two `UPDATE` statements and the constitution gains a named
§7 exception; no other requirement or task changes.

---

### REQ-023 — An archived rate must not reserve its date slot  ·  P1  ·  *(new 2026-09-21; **user-approved for this milestone**)*

`client_job_pricing` soft-deletes via `is_archived`, but its uniqueness does not respect that flag:
`client_job_pricing_client_id_job_id_effective_from_key UNIQUE (client_id, job_id, effective_from)`
(`20260918120000_hourly_pricing_and_client_job_pricing.sql:96`) counts archived rows.

**The defect.** An admin archives a wrong rate, then adds the corrected rate for the same client +
job + `effective_from`, and is told "A rate for this job already starts on that date." while the
list shows no such active rule. The only escape in the current UI is to restore the archived row
and edit it — the admin cannot discover this from the screen.

**Acceptance:**
- Uniqueness on `(client_id, job_id, effective_from)` applies only `WHERE is_archived = false`.
- Archiving a rate and then creating a new rate for the same triple **succeeds**.
- Two **live** rates for the same triple are still rejected, and still surface as a field error on
  the date, not as an unhandled 500.
- No row's stored data changes; the migration is a pure relaxation and carries verified DOWN SQL.
- The resolver is unaffected: `pickEffectiveRule` / `fetchClientJobRules` already read only
  non-archived rows.

**Depends on**: REQ-015. **Phase**: 3 (`03-02`).

---

### REQ-024 — A cancellation never overwrites a completed appointment  ·  P0  ·  *(new 2026-09-22; GitHub issue #15; **SCHEDULED — Phase 5**)*

`cancelAppointment` (`src/lib/actions/appointments.ts:895-920`) has no status filter of any kind, so
it will set `status = 'cancelled'` on an appointment whose status is `completed`. The detail page
offers the Cancel control for every status but `cancelled`
(`appointments/[id]/page.tsx:207-227`), completed included. Combined with REQ-025's defect, the
completion is then unrecoverable.

**Acceptance:**
- `cancelAppointment` refuses an appointment whose status is `completed` and returns an explicit
  error; the stored status is unchanged, verified by SQL after the attempt.
- `cancelAppointment` also refuses an appointment already at `cancelled`, with its own message. This
  is reachable from a stale page and, without the refusal, would write an illegal marker value.
- The appointment detail page renders **no** Cancel control when the status is `completed`. It is
  hidden, not disabled, and no error text is displayed — the page's server-action wrappers discard
  results, so an error return would be invisible (D-37).
- The Edit control is unchanged and still rendered for every status.
- The cancel write is a compare-and-set on the status read a moment earlier, so a concurrent status
  change cannot be silently overwritten.
  > **Scope note, added 2026-09-22 (AMD-5).** This bullet is about `cancelAppointment` and stays
  > that way. The same protection on the **form's** cancel path — `updateAppointment` — is **not**
  > this requirement; it is **REQ-028**, added post-implementation. Read the two together: REQ-024
  > closes the button path, REQ-028 closes the form path, and the defect is identical on both.

**Depends on**: nothing. **Phase**: 5 (`05-02`).

---

### REQ-025 — Reopening restores the status the cancellation replaced  ·  P0  ·  *(new 2026-09-22; GitHub issue #15; **SCHEDULED — Phase 5**)*

`uncancelAppointment` (`:922-948`) writes the literal `'scheduled'`, so an appointment cancelled
while `in_progress` comes back as `scheduled` and — before REQ-024 — an appointment cancelled while
`completed` came back as `scheduled` with no record it was ever completed. Nothing else in the row
records the prior status: completion is an explicit admin write, an appointment can be completed
with no crew at all, and `employee_clock` has no status predicate, so clock times are not a proxy.

**Acceptance:**
- `appointments` carries `status_before_cancel text NULL`, added by an **additive** migration with
  **no backfill** and verified DOWN SQL in its header comment (constitution §4), and the matching
  hand edit to `src/types/database.ts` lands in the same task (constitution §9).
- Two CHECK constraints hold the invariant: the value is one of
  `'scheduled' | 'in_progress' | 'completed'` or NULL, **and** it is non-NULL only while
  `status = 'cancelled'`. `'cancelled'` is rejected as a value. Both are proven to fire, on real
  rows, in both directions.
- The marker is written by **both** paths into `cancelled` — `cancelAppointment` and
  `updateAppointment`'s status field — and cleared by `uncancelAppointment`. No other code writes it.
  > **Amendment 2026-09-22 (AMD-5), cause: post-implementation `/code-review high`.** This bullet
  > required only that the marker be *written* on both paths. It said nothing about the marker being
  > **true**, and on the `updateAppointment` path it can be false: the status is read at
  > `appointments.ts:633-638` and written many statements later, so a concurrent completion in
  > another tab is overwritten and the marker records `'scheduled'` for a row that was `completed`.
  > The write that closes that gap is specified in **REQ-028**, not here. The original text of this
  > bullet is unchanged and still correct as far as it goes.
- Reopening restores the recorded status exactly: `in_progress` comes back as `in_progress`.
- Reopening a row whose marker is NULL restores `'scheduled'`. NULL means *not recorded* — every row
  cancelled before this phase — and that fallback is the documented behaviour, not a defensive
  guess.
- The column is **not** added to `appointments_employee_view`, which lists its columns explicitly.
- No existing stored value changes. Rows already at `status = 'cancelled'` keep NULL.

**Depends on**: nothing. Delivered jointly with REQ-024. **Phase**: 5 (`05-01` schema, `05-02`
behaviour).

---

### REQ-026 — Editing an appointment never destroys clock data  ·  P0  ·  *(new 2026-09-22; GitHub issue #15; **SCHEDULED — Phase 5**)*

`updateAppointment` deletes every `appointment_employees` row for the appointment and re-inserts one
per submitted employee (`:739-764`) on **every** non-`series` edit. That discards `clocked_in_at`,
`clocked_out_at` and `admin_notes`, and changes the row `id` that both `updateClockTime` and the
`employee_clock` RPC address. **This fires on ordinary `scheduled` appointments** — an employee
clocks in, an admin fixes the end time, the hours are gone — so it is independent of cancellation
and is the widest defect in issue #15.

**Acceptance:**
- An edit that keeps an employee assigned leaves that employee's row **completely unwritten**: same
  `id`, same `clocked_in_at`, same `clocked_out_at`, same `admin_notes`, same `is_archived`.
- An edit that adds an employee inserts only the new row, with `admin_notes: ''` as today.
- An edit that removes an employee deletes only that employee's rows, by `id`.
- Duplicate rows for one employee are all preserved when that employee survives and all deleted when
  they do not. They are never collapsed — `appointment_employees` has no unique constraint on
  `(appointment_id, employee_id)`, so duplicates exist and de-duplicating would be a silent delete.
- The reconcile reads every row for the appointment with **no `is_archived` filter**, matching the
  delete it replaces.
- An empty submitted crew still removes every row, unchanged from today.
- Proven in a browser: clock in and out, save an admin note, edit an unrelated field, and all four
  values plus the row `id` survive.

**Depends on**: nothing. **Independently shippable** — it needs neither the migration nor the status
work. **Phase**: 5 (`05-02` · T1).

---

### REQ-027 — A cancelled appointment cannot be edited  ·  P0  ·  *(new 2026-09-22; GitHub issue #15; **SCHEDULED — Phase 5**)*

The only server-side edit guard is `status === 'completed'` (`:648-653`), mirrored on the edit page
(`appointments/[id]/edit/page.tsx:178-181`). A cancelled appointment is therefore freely editable,
which is how an admin fixing a typo reached the REQ-026 defect in the issue's second repro.

**Acceptance:**
- `updateAppointment` refuses an appointment whose status is `cancelled`, in its own branch with its
  own message naming the remedy (reopen first). The `completed` branch is unchanged.
- The edit page renders an amber panel in place of the form for a cancelled appointment, matching
  the existing completed panel's styling exactly.
- The Edit control on the detail page still appears for every status; the refusal is explained on
  arrival, which is this codebase's existing idiom.
- Consequence, deliberate: `cancelled` has exactly one exit, the Reopen control, which REQ-025 makes
  lossless. The form's status `<select>` can therefore no longer move a row out of `cancelled`, so
  the marker needs clearing on exactly one path.

**Depends on**: REQ-025 (the reopen path must be lossless before editing is blocked, or an admin who
needs to change a cancelled appointment has no non-destructive route). **Phase**: 5 (`05-02`).

---

### REQ-028 — An appointment edit never silently overwrites a concurrent status change  ·  P0  ·  *(new 2026-09-22, **AMD-5** — added post-implementation to describe what shipped)*

> **This requirement is an amendment, and it is the second kind: the implementation was right and
> the spec was short.** Cause: the `/code-review high` pass run after `05-02-T1` landed. The
> reviewer found a live lost-update on the form's cancel path; the fix was made and the `verifier`
> confirmed it in round 2, then correctly flagged it as **scope beyond the REQ text as literally
> written** — *"REQ-024's compare-and-set bullet is scoped explicitly to `cancelAppointment`;
> REQ-025's acceptance says only that the marker must be 'written by both paths', with no
> compare-and-set requirement for the `updateAppointment` path."* That reading is correct. The
> shipped code is also correct. The gap was in the plan, and this requirement closes it.
>
> **Why a new REQ and not a widening of REQ-024 or REQ-025.** What shipped is broader than either
> would honestly describe. `.eq('status', existingAppointment.status)` guards **every** non-`series`
> edit, not only an edit that selects *Cancelled* — because the form always submits a `status`, an
> edit that touches only the notes field will write the form's stale status back over a concurrent
> change. Folding that into REQ-024 ("a cancellation never overwrites a completed appointment")
> would misname it, and folding it into REQ-025 (which is about a column's contents) would make a
> data requirement carry a concurrency rule. A separate ID also keeps the audit legible: REQ-024 and
> REQ-025 were satisfied as written, and this is additional, traceable work.

`updateAppointment` reads the appointment at `src/lib/actions/appointments.ts:633-638` and issues its
`.update(...)` many statements later. Between the two, another tab — or the detail page's Cancel /
Reopen controls, or a second admin — can change `status`. Without a status predicate on the update
the stale form value wins, and the damage is exactly the damage this phase exists to prevent: an
appointment marked `completed` in tab B is written back to `scheduled` by tab A's ordinary edit, and
if tab A's edit selects *Cancelled* the row lands at `cancelled` with
`status_before_cancel = 'scheduled'` — the completion destroyed **and** the new marker asserting a
falsehood about what it replaced. `05-CONTEXT.md §2.9` establishes that `updateAppointment` is the
second door into `cancelled`; this requirement is the guard on that door.

**Acceptance:**
- The appointment `.update(...)` in `updateAppointment`'s non-`series` branch carries
  `.eq('status', existingAppointment.status)` alongside its existing `.eq('id', id)` and
  `.eq('is_archived', false)` — a compare-and-set on the status read in that same action. It applies
  to **every** non-`series` edit, not only to edits that set `cancelled`.
- Concurrency proof, by SQL: with the edit form open on a `scheduled` appointment, set
  `status = 'completed'` on that row directly, then submit the form. The stored `status` is still
  `completed`, `status_before_cancel` is still NULL, and the submitted field values were **not**
  written.
- A zero-row update is **disambiguated before it is reported.** The action re-reads the row by `id`
  and `is_archived = false`: if it still exists, the error is
  `'The appointment changed while you were editing it. Refresh and try again.'`; only if it is gone
  or archived is it `'Appointment not found.'` A lost update is never misreported as a missing
  appointment.
- That message is **visible to the admin** — unlike the detail page's refusals (KL-03). The edit
  form is a Client Component using `useActionState` and rendering `state.error`
  (`src/components/admin/appointment-form.tsx:85`, `:153-159`).
- **Nothing downstream of the update runs when the guard does not match.** The assignment reconcile
  (REQ-026), the `future`-scope regeneration and both `revalidatePath` calls all sit behind the
  successful update, so a lost update changes no crew and no occurrence.
- The `series` edit scope is **out of scope**: it updates `recurrence_series`, never the appointment
  row, and has no status to compare.

**Depends on**: REQ-025 (the marker this guard protects is written on this path). Shipped jointly
with it. **Phase**: 5 (`05-02` · T1).

---

## Coverage matrix

| REQ | Phase | Plan · Task |
|---|---|---|
| REQ-001 | 1 | 01-01 · T1 |
| REQ-002 | 1 | 01-01 · T1 |
| REQ-003 | 1 | 01-01 · T1 |
| REQ-004 | 1, 2 | 01-02 · T1 (module); 02-02 · T1, T2 (adoption) |
| REQ-005 | 1, 2 | 01-02 · T1 (module); 02-01 · T1, 02-02 · T1, T2 (adoption) |
| REQ-006 | 1, 2 | 01-01 · T1 (schema/backfill); 02-02 · T2 (code) |
| REQ-007 | 1 | 01-01 · T1 |
| REQ-008 | 1 | 01-01 · T1 |
| REQ-009 | 1 | 01-01 · T1 |
| REQ-010 | 1 | 01-01 · T2 |
| REQ-011 | 1 | 01-02 · T1 |
| REQ-012 | 2 | 02-01 · T1 (server), T2 (UI) |
| REQ-013 | 2 | 02-02 · T1 (appointments), T2 (invoices) |
| REQ-014 | 2 | 02-02 · T1 |
| REQ-015 | 3 | 03-01 · T1, T2, T3 |
| REQ-016 | all | constitution §5, §6 |
| REQ-017 | 1, 2 | 01-01 · T1 (established: `tsc` clean, breakage is runtime-only); 02-01 · T1, T2 + 02-02 · T1, T2 (grep sweep); Phase 2 gate |
| REQ-018 | 1, 2 | 01-01 · T1 (column + backfill); 02-02 · T2 (write path) |
| REQ-019 | 1 | 01-03 · T1 (migration), T2 (queries) |
| REQ-020 | 1 | 01-03 · T1 (migration), T2 (queries) |
| REQ-021 | 2 | 02-01 · T1, T2 and 02-02 · T1, T2 smoke scripts; enforced at the Phase 2 gate |
| REQ-018 (AMD-1 remediation) | 2 | 02-03 · T1 (revert `voidInvoice`) |
| REQ-002 (AMD-2 remediation) | 2 | 02-03 · T2 (restore the check's cache invariants) |
| REQ-022 | **4** | **SCHEDULED 2026-09-21 as GitHub issue #18.** 04-01 · T1 (partial unique index + `database.ts`), T2 (check-script narrowing); 04-02 · T1 (`voidInvoice` releases + clears), T2 (both builder queries). **All-or-nothing: no subset closes it.** |
| REQ-002 (AMD-3 / AMD-3b) | 4 | 04-01 · T2 — Branch B in force, narrowed to `is_archived` with no invoice-status predicate, both invariants together (D-25). |
| REQ-018 (AMD-4) | 4 | 04-02 · T1 — the `voidInvoice` clause of REQ-018's acceptance is split; archive/restore/issue unchanged (D-24). |
| REQ-023 | 3 | 03-02 · T1 (partial unique index on `client_job_pricing`) |
| REQ-024 | **5** | **SCHEDULED 2026-09-22 as GitHub issue #15.** 05-02 · T1 (the refusal in `cancelAppointment` + its compare-and-set), T2 (the hidden Cancel control). The *form* path's compare-and-set is **REQ-028**, not this row (AMD-5). |
| REQ-025 | **5** | 05-01 · T1 (column + two CHECKs + `database.ts`); 05-02 · T1 (written on both cancel paths, read and cleared by `uncancelAppointment`). **Neither half PASSes alone.** The marker's *truthfulness* on the `updateAppointment` path rests on REQ-028 (AMD-5). |
| REQ-026 | **5** | 05-02 · T1 (the `appointment_employees` reconcile). Independently shippable — needs no migration. |
| REQ-027 | **5** | 05-02 · T1 (server guard), T2 (edit-page panel). |
| **REQ-028** | **5** | **AMD-5, added 2026-09-22 after implementation** (cause: `/code-review high`; confirmed by the verifier as scope beyond the REQ text as written). 05-02 · T1 — `.eq('status', existingAppointment.status)` on `updateAppointment`'s appointment update, plus the disambiguating re-read that distinguishes a lost update from a missing row. **Already shipped and verified;** no new task. |

REQ-019 and REQ-020 are jointly delivered by both `01-03` tasks and **neither can PASS alone**: T1
lands the views and drops the policies, T2 re-points the three employee queries through them. Between
the two, the employee screens are broken by construction.

**Reconciliation note (plan-check gap 4):** `02-01-T1` previously self-declared REQ-004 while never
calling the resolver. The matrix was right and the plan was wrong. `02-01-T1` touches
`parseDollarsToCents` and `formatRate`, which belong to REQ-005's adoption clause, not to REQ-004.
Its declaration has been corrected to **REQ-012 (server half) + REQ-005 (adoption)**.

---

## Known limitations

Capabilities this milestone deliberately does not deliver, recorded at the human's explicit request
so they are findable later rather than rediscovered as bugs. These are **not** requirements and no
task implements them.

### KL-01 — A per-client *flat* quote cannot be expressed as a standing rule

**What is not possible.** There is no way to record "Client A pays a fixed $200 for Deep Clean,
however long the visit takes" as a persistent rule. Under D-09 every job carries one
`hourly_rate_cents` and nothing else, and under D-16 `client_job_pricing` carries one
`hourly_rate_cents` and nothing else. Every standing price in the system is a rate multiplied by
scheduled minutes.

**Why.** ARCH-1 (D-09) removed the flat/hourly discriminator from `jobs` at the human's direction.
Reintroducing one on the newer `client_job_pricing` table would leave the two pricing surfaces
disagreeing about what a price is, and would restore the two-branch resolver, the two-branch CHECK,
the mode selector and the mode-aware formatting that D-09 was chosen to delete. See D-16.

**The workaround that exists today.** `appointments.price_override_cents` — a manual flat amount,
typed per visit, highest precedence in the resolver, entirely unchanged by this milestone. It is
per-appointment, so an admin retypes it on each visit; that is exactly the recurring-retyping pain
issue #10 set out to reduce, so the workaround is real but unsatisfying for a client who genuinely
has a fixed contract price.

**Reversal path — purely additive, no data migration, nothing here forecloses it.**
1. `ALTER TABLE public.client_job_pricing ADD COLUMN flat_price_cents integer NULL;`
2. `ALTER TABLE public.client_job_pricing ADD COLUMN pricing_mode text NOT NULL DEFAULT 'hourly';`
   — every existing row backfills to `'hourly'` from the default and keeps its current meaning, so
   no stored value changes and constitution §7 is satisfied without a carve-out.
3. A shape CHECK mirroring the one D-16 removed, `hourly_rate_cents` becoming nullable.
4. `ResolvedPrice` regains a mode branch; `resolveAppointmentPrice` gains one `if`.
5. The Phase 3 form regains a mode `<select>`; `client-job-pricing-list.tsx` formats by mode.
Steps 1–3 are one additive migration. The reason to defer is that it costs a schema discriminator
and a permanently two-branch resolver to serve a case nobody has yet reported having.

**What would make this a real requirement.** An admin asking for it, or a signed client contract
with a fixed per-visit price and a variable visit length. Until then it is a limitation, not a gap.

### KL-03 — Every refusal on the appointment **detail** page is invisible  *(new 2026-09-22, Phase 5)*

**What happens.** The appointment detail page's Cancel and Reopen controls are `'use server'`
wrapper functions that **discard the action's return value**
(`src/app/(internal)/solutions/(admin)/appointments/[id]/page.tsx:157-167`). Every error string
Phase 5 added on those two paths is therefore never displayed. The admin sees a click that does
nothing:

- `'A completed appointment cannot be cancelled. Completed is a final status.'`
- `'This appointment is already cancelled.'` / `'This appointment is not cancelled.'` — the
  double-submit refusals, reachable from a stale page.
- `'The appointment changed while you were cancelling it. Refresh and try again.'` and the same for
  reopening — the REQ-024 / REQ-025 race messages.

**Why it was not fixed.** `05-CONTEXT.md §5` and `05-02-PLAN.md` T2's out-of-scope list put
converting that page to a Client Component with `useActionState` explicitly out of scope, and D-37
decided the `completed` case by **hiding** the Cancel control rather than reporting a refusal — the
`COMPLETED` badge a few inches away is the explanation, and a disabled-looking button would read as
a broken page. The server guards stay regardless: their job is to prevent the write from a stale
page or a replayed submission, not to narrate it.

**What it costs.** For the `completed` case, nothing — the control is not rendered, so the refusal
is unreachable from the UI. For the remaining cases the cost is a silent no-op: a double-submitted
Cancel, or a Cancel losing a race with another tab, looks like a click that did not register. The
write is correctly refused either way; only the explanation is missing.

**This limitation does not extend to the edit page.** `updateAppointment`'s refusals — the
`completed` guard, REQ-027's `cancelled` guard and REQ-028's "changed while you were editing it" —
are all displayed, because `appointment-form.tsx` is a Client Component that renders `state.error`
(`:85`, `:153-159`).

**Reversal path.** Convert `appointments/[id]/page.tsx` to a Client Component (or extract the two
control forms into one), hold the action results in `useActionState`, and render the error beside
the control. It is a self-contained change to one file and needs no schema, action or requirement
change. Worth its own issue rather than a Phase 5 task.

### KL-02 — Employees see no earnings figure at all

REQ-020 removes every price an employee could previously reach, and **nothing replaces it**: no
placeholder, no estimated earnings, no "pay TBD". That is correct today, because what an employee is
paid is a different number from what a client is billed and the pay-rate model does not exist — it
is issue #11, out of scope (constitution §17). Recorded here so that "the employee schedule shows no
money anywhere" is understood as the designed outcome of ARCH-5 = (b) and not as a regression
introduced by the masking work.
