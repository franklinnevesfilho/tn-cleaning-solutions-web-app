# 01-RESEARCH — Pricing foundation

Everything below was verified against the working tree at `7ae55f5` on 2026-09-18, not recalled.
§10–§13 were added on the 2026-09-18 replan and verified the same way.

## 1. The `AGENTS.md` claim

`AGENTS.md:2-4` states "This is NOT the Next.js you know … breaking changes … read
`node_modules/next/dist/docs/`".

Verified:
- `package.json` pins `"next": "16.2.4"`, `"react": "19.2.4"`, `"eslint-config-next": "16.2.4"` —
  no fork, no patch, no override.
- `node_modules/next/dist/docs/` contains the stock upstream App Router documentation tree
  (`01-app/`, `02-pages/`, `03-architecture/`, `04-community/`).
  `01-app/01-getting-started/07-mutating-data.md` describes ordinary Server Functions /
  `'use server'` / `revalidatePath` — the exact pattern already in `src/lib/actions/*.ts`.

**Conclusion**: the banner is unsupported. It changes nothing about this milestone, which adds no
new framework pattern — every new server action is a copy of the existing shape. The project rule
still stands: executing agents read
`node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` and
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`
before editing a server action.

## 2. Test runner capability (verified by running it)

Node in this environment is **v25.8.1**, which strips TypeScript types natively.

Confirmed working:
```
node --test "tests/**/*.test.ts"     # glob form — passes
```
Confirmed **not** working:
```
node --test tests/                   # directory arg is resolved as a module → MODULE_NOT_FOUND
import { add } from './m'            # extensionless specifier → ERR_MODULE_NOT_FOUND
```
So: quoted glob in the npm script, and **every relative import inside `tests/` must carry the
`.ts` extension**.

`tsc` rejects `.ts` import specifiers (TS5097) unless `allowImportingTsExtensions` is set.
`tsconfig.json`'s `include` is `["next-env.d.ts", "**/*.ts", "**/*.tsx", ...]`, so without an
exclude entry `next build` would type-check the test files and fail on their `.ts` imports.

**Corrected 2026-09-18.** This section originally concluded that excluding `tests/` avoided having
to change any compiler option. That was wrong, and the error only surfaced once `resolve.ts` was
written: it takes a **value** import from `money.ts`, so it too needs the literal `./money.ts`
specifier — and it lives in `src/`, which `next build` type-checks regardless of what `tests/` is
excluded. Excluding `tests/` never could have been sufficient. Both changes are therefore needed and
both are authorized (DET-8):
- `"allowImportingTsExtensions": true` — legal because the project already sets `"noEmit": true`,
  which is the precondition TypeScript requires for the flag;
- `"exclude": [..., "tests"]` — kept, now for the narrower purpose of keeping test files out of the
  production build's type-check surface rather than to dodge a compiler-option change.

Source files under `src/lib/pricing/` must stay **erasable-syntax-only** (no `enum`, no
`namespace`, no constructor parameter properties) so Node can strip them. Plain `type`/`interface`
annotations are fine.

## 3. Latent defect: `invoice_appointments` cannot be UPDATEd

- Table definition (`supabase/migrations/20260427000000_schema_snapshot.sql:234-237`):
  `invoice_id uuid NOT NULL`, `appointment_id uuid NOT NULL`. That is all.
- Trigger (`:448`): `CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON
  "public"."invoice_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();`
- Function (`:108-115`): `NEW.updated_at = now();`

An UPDATE therefore raises `record "new" has no field "updated_at"`. It has never fired because
`src/lib/actions/invoices.ts:378-392` deletes all links and re-inserts them instead of updating.

`src/types/database.ts:317-338` separately declares `created_at`, `updated_at` and `is_archived`
on this table — columns that do not exist. That is a third instance of the hand-maintained-types
drift `CODEBASE-MAP.md §6` records.

Fix chosen: add the three missing columns (matching every other table in the schema) rather than
drop the trigger. This also makes `database.ts` correct for the first time.

## 4. Money handling as it stands

- Three independent dollars→cents parsers, all `Math.round(Number(raw) * 100)`:
  `src/lib/actions/appointments.ts:82-93` (returns `number | null | 'invalid'`),
  `src/lib/actions/invoices.ts:66-77` (returns `number | null`),
  `src/lib/actions/jobs.ts:62-93` (inline, no function).
- Six independent cents→dollars formatters — `src/lib/utils.ts` contains only `cn()`.
- The effective price expression `price_override_cents ?? base_price_cents ?? 0` appears at
  `src/lib/actions/invoices.ts:182`, `invoices/[id]/page.tsx:128`,
  `appointments/[id]/page.tsx:125`, `src/components/admin/invoice-form.tsx:65`.
- `src/components/admin/appointments-types.ts:16` and
  `src/components/admin/new-appointment-schedule-context.tsx:16,29,103` fetch
  `base_price_cents` and **never render it** — verified by grepping every consumer of
  `AppointmentSummary` (`appointments-list.tsx`, `appointments-calendar.tsx`,
  `appointments-view-toggle.tsx` reference the type but no price field). Dead data.

## 5. Employee exposure to job pricing

- `"Employee select jobs"` (`:582`) is `FOR SELECT USING (NOT is_archived)` — no column filter,
  because RLS is row-level only.
- The three employee-facing queries that touch `jobs` select only `name` and `description`:
  `(employee)/schedule/page.tsx:456-459`, `(employee)/schedule/[id]/page.tsx:178-181`,
  `(employee)/time-sheets/page.tsx:109-111`.

So no employee *screen* shows a price, but the policy permits reading one directly. See ARCH-5.

## 6. Column-masking precedent

`supabase/migrations/20260917120000_secure_appointment_employees_view.sql` is the reference
implementation: drop the employee base-table SELECT policy, create the view with
`security_invoker='false'`, put the row filter *inside the view body*, then
`REVOKE ALL` / `GRANT SELECT` so the definer view is not writable. Its header comments explain
each step. Any new masking work must follow it exactly.

Note also `:122-131`: revoking `EXECUTE` from `PUBLIC` on a plpgsql `SECURITY DEFINER` function
crashes the Supabase Postgres 17.6 image with SIGSEGV. Do not attempt to tighten function grants.

## 7. Grants convention

Every table in the snapshot carries `GRANT ALL ... TO anon, authenticated, service_role`
(e.g. `:892-894` for `jobs`), with RLS as the only gate. `client_job_pricing` follows the same
convention for consistency — with no employee policy and no anon policy, neither role can read a
row despite the grant.

## 8. Seed paths that hardcode pricing

- `supabase/test-data.sql:85-100` — `INSERT INTO public.jobs (name, description,
  base_price_cents, estimated_duration_minutes)` with `15000, 120`, guarded by
  `WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE name = 'Standard House Cleaning')`.
- `scripts/seed-admin-users.ts:222-232` — the same job, same values, via the JS client.
- `supabase/seed.sql` is comments only; it creates nothing.

Both seeds are idempotent by name lookup and must stay that way.

## 9. Constraints already enforced in code that the new model can rely on

- `appointments.scheduled_end_time > scheduled_start_time` is validated on create and update
  (`src/lib/actions/appointments.ts:235-243` and `:348-356`), so a scheduled duration is always
  strictly positive and never crosses midnight.
- Only `draft` invoices can be edited (`src/lib/actions/invoices.ts:343-345`), so frozen line
  amounts on issued/paid/void invoices can never be rewritten by the normal flow.
- `invoice_appointments_appointment_id_key` (`:352`) means an appointment belongs to at most one
  invoice — so "the frozen price of this appointment" is unambiguous.

## 10. The rename's blast radius (added on the 2026-09-18 replan)

`grep -rn base_price_cents src supabase scripts` at `7ae55f5` returns **57 matching lines across 21
files** (corrected 2026-09-18 — the earlier figure of 56 undercounted `job-form.tsx` by one; the
verifier re-ran the grep and every other per-file count below was already right). Note the unit:
these are *matching lines*, not occurrences — `grep -rno` counts 62, because some lines name the
column twice. Every file is owned by exactly one task; the union was re-checked for collisions and
is reproduced in `ROADMAP.md`. Grouped by owner:

| Owner | Files |
|---|---|
| 01-01-T1 | `src/types/database.ts` (3) |
| 01-01-T2 | `supabase/test-data.sql` (1), `scripts/seed-admin-users.ts` (1) |
| 02-01-T1 | `src/lib/actions/jobs.ts` (6), `src/components/admin/jobs-list.tsx` (2), `(admin)/jobs/page.tsx` (2), `(admin)/jobs/[id]/edit/page.tsx` (2) |
| 02-01-T2 | `src/components/admin/job-form.tsx` (9) |
| 02-02-T1 | `(admin)/appointments/page.tsx` (3), `(admin)/appointments/[id]/page.tsx` (3), `(admin)/appointments/new/page.tsx` (1), `(admin)/appointments/[id]/edit/page.tsx` (1), `appointment-form.tsx` (2), `appointments-types.ts` (1), `new-appointment-schedule-context.tsx` (3) |
| 02-02-T2 | `src/lib/actions/invoices.ts` (3), `invoice-form.tsx` (3), `(admin)/invoices/new/page.tsx` (3), `(admin)/invoices/[id]/page.tsx` (3), `(admin)/invoices/[id]/edit/page.tsx` (4) |
| nobody | `supabase/migrations/20260427000000_schema_snapshot.sql:290` — a landed migration; never edited |

Consequence: the rename cannot land and be type-clean in the same phase without either colliding
with all four Block-2 tasks or serialising the milestone behind one mechanical sweep. Hence D-19 —
Phase 1 ships red, bounded by REQ-017.

## 11. `invoice_appointments` write paths — the complete set

`src/lib/actions/invoices.ts` is the only module that writes the junction, and it does so in
exactly two places:
- `createInvoice` — `.insert(...)` at ~267-272, after inserting the invoice.
- `updateInvoice` — `.delete().eq('invoice_id', id)` at ~378-382, then `.insert(...)` at ~386-392.
  Guarded by the draft-only check at ~343-345.

There is **no hard delete of an invoice anywhere in `src/lib/actions/`** — the only three `.delete()`
calls in that directory are `invoices.ts:380` (the junction) and `appointments.ts:757,889`
(employee assignments and occurrences). Invoices are voided (`status='void'`) and archived
(`is_archived=true`); the junction rows survive both.

That closed write path is what makes `appointments.billed_price_cents` (REQ-018) a bounded cache
rather than a fan-out: two call sites write it, both already write the junction in the same action.

**Latent dead code that the new work needs:** `updateInvoice` fetches the previous link set into
`linkedRows` at `src/lib/actions/invoices.ts:347-357` and **never uses it** (verified: `linkedRows`
appears exactly once in the file). That is precisely the "appointments removed from this invoice"
set REQ-018 must clear. Use it; do not re-fetch.

## 12. Employee reads of `jobs` and `appointments` — the complete audit

**Re-run in full on 2026-09-18** when ARCH-5 was widened to option (b) (full confidentiality —
appointment price columns masked too). Line numbers verified against the live files at `7ae55f5`.

### 12a. Every employee-reachable read of `appointments`

Three, all in TypeScript, all the same shape: `appointment_employees_employee_view` →
`appointments!inner(...)` → `jobs!inner(...)`. All three are owned by **01-03-T2**.

| File | `.from(...)` | `appointments!inner` at | `jobs!inner` at | Price columns selected |
|---|---|---|---|---|
| `(employee)/schedule/page.tsx` | 435 | 441 | 452 (`client_locations`), 456 (`jobs`) | none |
| `(employee)/schedule/[id]/page.tsx` | 156 | 163 | 174 (`client_locations`), 178 (`jobs`) | none |
| `(employee)/time-sheets/page.tsx` | 98 | 104 | 109 (`jobs`) | none |

Plus a **fourth and fifth** query that read `appointment_employees_employee_view` but embed only
`employees_employee_view` — `schedule/page.tsx:482` and `schedule/[id]/page.tsx:197`. They touch
`appointments` not at all and need no change; do not "tidy" them.

No employee-facing query selects `price_override_cents` today, so **nothing is currently rendered
that has to be removed**. The exposure is purely PostgREST-level: `"Employee select assigned
appointments"` (`20260427000000_schema_snapshot.sql:574`) is a base-table SELECT policy, so an
employee's own JWT can fetch
`GET /rest/v1/appointments?select=price_override_cents&id=eq.<their appointment>` directly. RLS
cannot mask a column; only a view can.

### 12b. One **indirect** employee read of `appointments` — the trap

`"Employee select locations for assigned appointments"` on `client_locations`
(`20260427000000_schema_snapshot.sql:586-588`) has a `USING` clause whose subquery reads
`FROM public.appointments a`. PostgreSQL applies a referenced table's own row-security policies
inside a policy expression (this is why cross-referencing policies produce
`infinite recursion detected in policy for relation ...`). Dropping `"Employee select assigned
appointments"` therefore makes that subquery return **zero rows for every employee**, and
employees silently lose the location address they see today at `schedule/page.tsx:266-267` and
`schedule/[id]/page.tsx:271-273`.

This is the one finding that could turn a security fix into a visible employee regression, and it
is invisible to any grep of the TypeScript. `01-03-T1` repairs it in the same migration with a
`get_employee_location_ids()` `SECURITY DEFINER` helper, mirroring the existing
`get_employee_appointment_ids()` (`:50-67`). Line 587 is the **only** place any policy or view in
any migration references `appointments`; verified with
`grep -n '"public"\."appointments"\|public\.appointments\b' supabase/migrations/*.sql`.

### 12c. What is *not* affected — checked, and deliberately left alone

- **`src/lib/actions/attendance.ts`** — employees call it, but it reads `appointments` nowhere. Its
  only DB call is `supabase.rpc('employee_clock', ...)` (`attendance.ts:32-35`), and
  `employee_clock` (`20260917120000_*:72-113`) touches `appointment_employees` only. **No change.**
- **`appointment_employees_employee_view`** (`20260917120000_*:21-31`) — selects eight columns of
  `appointment_employees` and joins nothing. It exposes no `appointments` column, and its row
  filter runs through `get_employee_appointment_ids()`, which is `SECURITY DEFINER` over
  `appointment_employees`, not over `appointments`. Unaffected by the policy drop. **No change.**
- **`src/lib/actions/profile.ts:36`** — reads `employees`. **No change.**
- **`src/components/admin/new-appointment-schedule-context.tsx:98`** — a `'use client'` component
  that hits `.from('appointments')` with the *user's* JWT, so it would break under the policy drop
  — but it renders only under `(admin)/appointments/new`, which the `(admin)` layout gate
  (`(admin)/layout.tsx:20-22`) redirects non-admins away from, and admins keep
  `"Admin full access on appointments"`. Not employee-reachable. Owned by **02-02-T1**.
- **`src/lib/actions/appointments.ts` and `src/lib/actions/invoices.ts`** — every exported function
  in both calls `requireAdminRole()` and then `createAdminClient()` (service role, RLS bypassed).
  Verified exhaustively for `appointments.ts`: exports at `:460, :610, :909, :936, :964, :993`,
  each gated at `:475, :631, :914, :941, :973, :1001`. **Not employee-reachable.**
- Every other `.from('appointments')` in the repo is under `(admin)/`.

**Conclusion: the only files that change for the appointment-price masking are the same three
`(employee)/` route files ARCH-5 already required. There is no collision with any Block-2 task.**

### 12d. Job reads, and the embed-inference risk (AS-10 / B-05)

There is no `.from('jobs')` call anywhere under `(employee)/`; every one in the repo is in an
`(admin)` route or in `src/lib/actions/jobs.ts`. All three employee job reads are the nested
`jobs!inner(...)` embeds in the table above, selecting only `name` / `description`. So neither half
of the lockdown costs a UI redesign — both are query-shape plus policy changes.

The embed risk, now **larger** than when B-05 was written:
- Proven today: `appointment_employees_employee_view → appointments!inner(...)` — a **view→table**
  embed that PostgREST resolves in this exact stack right now.
- ARCH-5 as originally scoped needed **table→view** (`appointments → jobs_employee_view`).
- ARCH-5 option (b) needs **view→view** (`appointment_employees_employee_view →
  appointments_employee_view`) **and** view→view again for the nested
  `appointments_employee_view → jobs_employee_view`. Views carry no foreign keys, so PostgREST has
  to trace both sides' column provenance back to the base-table FK.

Neither view→view hop is proven here. Both fallbacks are specified in `01-03-PLAN.md` T2, and
`appointments_employee_view` deliberately exposes `job_id` and `location_id` so the fallback needs
no schema change and therefore no edit to 01-03-T1's migration.

## 13. Seed values under the reinterpretation

Both seed paths create the same job, `'Standard House Cleaning'`, at `base_price_cents = 15000`
(`supabase/test-data.sql:85-100`, `scripts/seed-admin-users.ts:222-232`), guarded by a name lookup
so whichever runs first wins.

Under D-09 that number becomes **$150.00/hour**, which would make a seeded 2-hour appointment bill
$300. Local data would then be implausible enough to mask real bugs, so 01-01-T2 changes it to
`4500`. This is a seed-value change only and carries no implication for production, which is
reinterpreted in place per D-09.
