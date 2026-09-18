# Codebase Map — TN Cleaning Solutions web-app

Produced by `codebase-analyst`, 2026-09-18, at commit `7ae55f5` (branch `improved-appointments`).
Scope: whole-repo structure with deep focus on the pricing domain (jobs / appointments / invoices).

> Note on `AGENTS.md`: the root `AGENTS.md` claims this is a non-standard Next.js requiring
> `node_modules/next/dist/docs/`. The analyst found that directory contains the stock Next.js docs
> and `package.json` pins plain `next@16.2.4` / `react@19.2.4`. Treat the claim as unverified.
> Still consult `node_modules/next/dist/docs/` before writing framework-specific code, per project rule.

## 1. Overall structure

**App routes** (`src/app`): three route groups.
- `(public)` — marketing page only.
- `(auth)` — login, accept-invite, reset-password.
- `(internal)/solutions` — gated by `src/app/(internal)/layout.tsx:1` (any authenticated user), further split:
  - `(admin)/...` — gated by `src/app/(internal)/solutions/(admin)/layout.tsx:1`; redirects to `/solutions/schedule` unless `user.app_metadata.role === 'admin'`. Contains jobs, appointments, clients, employees, invoices, dashboard, time-tracking.
  - `(employee)/...` — schedule, time-sheets. No layout gate beyond `(internal)`; separation relies on RLS.
  - `profile/` — shared.

No `middleware.ts`. All auth/role gating happens in server-component layouts.

**Roles**: exactly two — `admin`, `employee` — from `user.app_metadata.role`, defaulted server-side by
`get_user_role()` (`supabase/migrations/20260427000000_schema_snapshot.sql:94-102`).
There is **no client role/login**; clients are rows in `clients` with no auth account.

**Server actions** (`src/lib/actions/*.ts`, all `'use server'`): one file per domain — jobs, appointments,
invoices, clients, employees, profile, attendance. Every write action follows:
`requireAdminRole()` (re-implemented per file, not shared) → hand-rolled `parseXFormData(formData)` →
`createAdminClient()` write → `revalidatePath(...)` (+ `redirect(...)` on create/update).

**Supabase clients** — three factories:
- `src/lib/supabase/server.ts:1` — cookie-based, RLS-enforced; used for `auth.getUser()` and user-scoped reads.
- `src/lib/supabase/browser.ts:1` — RLS-enforced, Client Components (e.g. `new-appointment-schedule-context.tsx:7`).
- `src/lib/supabase/admin.ts:1` — service-role, `server-only`, **RLS bypassed**. Used by every mutating action,
  so the manual `requireAdminRole()` check *is* the authorization boundary for those writes.

**Type generation**: `src/types/database.ts` is **hand-maintained**, not CLI-generated. No `supabase gen types`
banner, no `Functions` block (the `employee_clock` RPC is absent, so `attendance.ts:32` is unchecked).
No regeneration script exists anywhere (`package.json`, `.github/`, `docs/`). Drift already exists — see §6.

**Validation**: no zod/yup or any schema library. All parsing is manual `String(formData.get(...))` +
`Number()`/regex checks, duplicated per action file:
`parseJobFormData` (`jobs.ts:48`), `parseCreateAppointmentFormData` / `parseUpdateAppointmentFormData`
(`appointments.ts:195,317`), `parseInvoiceFormData` (`invoices.ts:79`).

## 2. Database schema (current effective state)

Base schema: `supabase/migrations/20260427000000_schema_snapshot.sql`. Later migrations
(`20260911155132` drops `pg_net`; `20260911170000` adds employee profile fields + a view;
`20260917120000` locks down `appointment_employees`/`employees` views, adds `employee_clock`)
do **not** touch jobs/appointments/clients/invoices core columns.

**`jobs`** (`20260427000000_schema_snapshot.sql:286-298`):
```
id uuid PK, name text NOT NULL, description text,
base_price_cents integer NOT NULL,           -- line 290
estimated_duration_minutes integer,          -- line 291, nullable
created_at, updated_at, is_archived boolean default false
```
RLS: `Admin full access on jobs` (line 562); `Employee select jobs` (line 582) `FOR SELECT USING (NOT is_archived)`
— **any authenticated employee can read `base_price_cents` off the base table today** (RLS is row-level only).

**`appointments`** (lines 160-176):
```
id uuid PK, client_id uuid NOT NULL FK->clients, job_id uuid NOT NULL FK->jobs,
recurrence_series_id uuid FK->recurrence_series,
scheduled_date date NOT NULL,
scheduled_start_time time NOT NULL,          -- line 166
scheduled_end_time time NOT NULL,            -- line 167
price_override_cents integer,                -- line 168, nullable, per-appointment flat override
status text NOT NULL default 'scheduled' (scheduled|in_progress|completed|cancelled),
notes, created_at, updated_at, is_archived, location_id uuid FK->client_locations
```
No duration column — duration is implied by `scheduled_end_time - scheduled_start_time`, computed ad hoc.
Effective price today is always `price_override_cents ?? jobs.base_price_cents`.
RLS: `Admin full access on appointments` (line 538); `Employee select assigned appointments` (line 574,
limited to `get_employee_appointment_ids()`).

**`clients`** (lines 198-215): `id, name, email, phone, address (DEPRECATED, line 215 — superseded by
`client_locations`), notes, is_active, created_at, updated_at, is_archived`. **No pricing columns of any kind.**
`client_locations` (lines 182-195) holds address/label per site; FK'd from `appointments.location_id`
and `recurrence_series.location_id`.

**`invoices`** (lines 243-258): `id, client_id FK, status (draft|issued|paid|void), issued_date, due_date,
total_cents integer NOT NULL, notes, created_at, updated_at, is_archived`.
`total_cents` is a **plain stored column, computed in application code** and written on every create/update
(`invoices.ts:256,370`). View `invoices_with_status` (lines 261-279) adds `effective_status`
(`'overdue'` when issued + past due); it does **not** recompute `total_cents`.

**Invoice line items**: **there is no line-item table.** `invoice_appointments` (lines 234-240) is a junction
only (`invoice_id`, `appointment_id`, unique on `appointment_id` — an appointment can belong to at most one
invoice). The "line item price" is each linked appointment's effective price, summed into `invoices.total_cents`
by `applyAppointmentPricesAndGetTotal()` (`invoices.ts:154-200`). Per-appointment price at invoice time is
**written back onto `appointments.price_override_cents`** (`invoices.ts:185-194`) rather than stored on the invoice.

**Functions/policies touching price or time**: none. No SQL function or RLS policy references
`base_price_cents`, `price_override_cents`, `estimated_duration_minutes`, or the time columns.

## 3. Pricing blast radius

### Job pricing/duration definition & CRUD
- `src/lib/actions/jobs.ts:22-23` — `ParsedJobInput` shape.
- `src/lib/actions/jobs.ts:62-67,93` — parses dollars → validates non-negative → `Math.round(parsedPrice * 100)`.
- `src/lib/actions/jobs.ts:69-83` — parses `estimated_duration_minutes` as positive whole minutes or `null`.
- `src/lib/actions/jobs.ts:135-137,189-191` — insert/update `jobs` via admin client.
- `src/components/admin/job-form.tsx:96-155` — only UI writing these fields; dollars shown via `base_price_cents/100` (line 107).

### Appointment price override
- `src/lib/actions/appointments.ts:82-93` — `parseMoneyToCents`, local to this file only.
- `src/lib/actions/appointments.ts:245-250,306,363,392` — create/update parse + write of `price_override_cents`.
- `src/lib/actions/appointments.ts:531,555,736,847` — every appointment insert (single, recurring-series
  generation, future-occurrence regeneration) carries `price_override_cents` through, **including copying the
  original occurrence's override onto every regenerated future occurrence** (line 847).
- `src/components/admin/appointment-form.tsx:197` — shows "Default price: $X" from `selectedJob.base_price_cents/100`.
- `src/components/admin/appointment-form.tsx:269-270` — pre-fills override input.
- `src/app/(internal)/solutions/(admin)/appointments/page.tsx:91,99` — list view per-row effective price.
- `src/app/(internal)/solutions/(admin)/appointments/[id]/page.tsx:125,223` —
  `effectivePriceCents = price_override_cents ?? jobs?.base_price_cents ?? 0`; rendered at 223.
- `src/app/(internal)/solutions/(admin)/appointments/[id]/page.tsx:229-230` — **only** place
  `estimated_duration_minutes` is shown to a user (read-only).
- `src/app/(internal)/solutions/(admin)/appointments/new/page.tsx:57`,
  `.../appointments/[id]/edit/page.tsx:67` — fetch `jobs(id, name, base_price_cents)` for the job picker.
  Duration is not fetched; no conflict/duration check exists anywhere.
- `src/components/admin/new-appointment-schedule-context.tsx:16,103` — fetches `base_price_cents` but
  **never renders it** (dead field).

### Invoicing (computing/persisting totals)
- `src/lib/actions/invoices.ts:27-34` — `AppointmentPriceRow` shape.
- `src/lib/actions/invoices.ts:133-152` — `fetchAppointmentsForPricing`, joins `jobs!inner(base_price_cents)`.
- `src/lib/actions/invoices.ts:154-200` — `applyAppointmentPricesAndGetTotal`: computes
  `basePriceCents = jobs.base_price_cents ?? 0`; when the admin-entered price differs from base, **writes it back
  to `appointments.price_override_cents`** (line 188); sums into `totalCents` (line 196). Single place
  `invoices.total_cents` is derived.
- `src/lib/actions/invoices.ts:256,370` — `total_cents` written on invoice create/update.
- `src/components/admin/invoice-form.tsx:60-65,320` — `currencyFromCents`;
  `initialPriceForAppointment = (price_override_cents ?? job_base_price_cents) / 100`; client-side `runningTotalCents`.
- `src/app/(internal)/solutions/(admin)/invoices/new/page.tsx:17-36,64-65`,
  `.../invoices/[id]/edit/page.tsx:18-33,68-69,101-102` — server fetch for the invoice builder.
- `src/app/(internal)/solutions/(admin)/invoices/[id]/page.tsx:42-47,128,145-146` — read-only detail.

### Totals display
- `src/app/(internal)/solutions/(admin)/invoices/page.tsx:21,114,165,170`
- `src/app/(internal)/solutions/(admin)/invoices/[id]/page.tsx:63,352,378`
- `src/app/(internal)/solutions/(admin)/dashboard/page.tsx:29,82,249,453`

### Not to be conflated
Time-sheet/time-tracking pages (`(employee)/time-sheets/page.tsx`, `(admin)/time-tracking/page.tsx`,
`(admin)/employees/[id]/time-sheets/page.tsx`, `components/employee/work-sessions-list.tsx`) each define their own
`formatDuration(hours, minutes)` over **worked time from `clocked_in_at`/`clocked_out_at`** — unrelated to
`jobs.estimated_duration_minutes`.

## 4. Money handling conventions

- **Integers-in-cents throughout.** `base_price_cents`, `price_override_cents`, `total_cents` are all `integer`
  columns / TS `number` carrying cents. No `numeric` or float money columns.
- **No shared money helper.** Cents→dollars formatting is reimplemented in 6+ places:
  `invoice-form.tsx:60-61` (`currencyFromCents`), `jobs-list.tsx:20-27` (`usdFormatter`/`formatPrice`),
  `invoices/page.tsx:21`, `invoices/[id]/page.tsx:63`, `dashboard/page.tsx:82` (three separate
  `Intl.NumberFormat` instances), plus raw `(cents/100).toFixed(2)` inline at `job-form.tsx:107`,
  `appointment-form.tsx:197,270`, `appointments/[id]/page.tsx:223`.
  `src/lib/utils.ts` contains only `cn()`.
- **Dollars→cents parsing** duplicated: `parseMoneyToCents` in `appointments.ts:82-93` and `invoices.ts:66-77`;
  `jobs.ts:62-93` inlines the same logic without extracting a function.

## 5. Migration conventions

- **Naming**: `YYYYMMDDHHMMSS_description.sql` (Supabase CLI convention). Only 4 files;
  `20260427000000_schema_snapshot.sql` is a full pg_dump-style snapshot, later ones are true incremental diffs.
- **RLS style**: RLS enabled on every table; policies named `"Admin full access on X"` / `"Employee select Y"`,
  gating on `get_user_role() = 'admin'` or helpers (`get_employee_id()`, `get_employee_appointment_ids()`),
  all `SECURITY DEFINER` with `SET search_path = 'public'`.
  **Column-level secrecy pattern**: `SECURITY DEFINER` view with `security_invoker=false` **plus removal of the
  base-table SELECT policy** — documented in commentary blocks in `20260911170000_*` and `20260917120000_*`
  (RLS cannot mask columns). Any new sensitive pricing column should follow this pattern.
- **No schema-snapshot regeneration step or CI check.** No `supabase db diff`/`db pull` automation;
  `.github/` holds only generic multi-agent scaffolding, no project CI. `package.json` has no `db:*` scripts.
- **Local workflow** (`docs/local-setup.md`): `supabase start` → `supabase db reset` (migrations + `supabase/seed.sql`)
  → `npm run seed:admin` (`scripts/seed-admin-users.ts`, creates 1 admin + 2 employees) →
  `npx supabase db query --file supabase/test-data.sql --local`.
  `supabase/test-data.sql:88` hardcodes `base_price_cents`; `scripts/seed-admin-users.ts:228-229,255,267-268`
  hardcode price/duration/times.

## 6. Danger zones for a pricing-model redesign

- **`src/types/database.ts` is hand-maintained and already drifted**: `jobs.description` typed non-nullable though
  the column is nullable; `jobs.estimated_duration_minutes` typed non-nullable (`number`) though the column
  (`schema_snapshot.sql:291`) is nullable and app code treats it as `number | null`
  (`jobs.ts:23`, `job-form.tsx:19`, `jobs-list.tsx:16`). No generator to catch drift.
- **`invoices.total_cents` is denormalized and app-computed** — any new pricing model must keep writing a correct
  total through `applyAppointmentPricesAndGetTotal` (`invoices.ts:154-200`) or rewrite it. Existing issued/paid
  invoices will not retroactively reflect a new model (likely desired, but must be an explicit decision).
- **Invoicing mutates `appointments.price_override_cents` as a side effect** (`invoices.ts:185-194`) — "price at
  invoice time" is back-written onto the appointment, not stored on the invoice. A negotiated per-client/per-job
  price changes what "differs from base" means; this logic needs reconsidering, not extending.
- **Recurring generation copies `price_override_cents` forward** (`appointments.ts:847`) — a negotiated price would
  need re-resolving per generated appointment rather than copying.
- **6+ currency formatters and 2+ dollars↔cents parsers** — no single choke point to extend.
- **Jobs are globally priced, not per-client.** Every current effective-price computation
  (`price_override_cents ?? jobs.base_price_cents ?? 0` at `invoices/[id]/page.tsx:128`,
  `appointments/[id]/page.tsx:125`, `appointments/page.tsx:91,99`, `invoice-form.tsx:65`) needs a **lookup step
  added**, not a column read changed.
- **Employees can read `jobs.base_price_cents` today** via `"Employee select jobs"` — if rates become sensitive
  negotiated data, tighten via the view-masking pattern already used for `employees`/`appointment_employees`.
- **No automated tests** anywhere near pricing (`*.test.ts*` matches nothing in these files). No regression harness
  for `applyAppointmentPricesAndGetTotal`, recurrence generation, or the form parsers.
- **Seeds hardcode pricing shape** (`supabase/test-data.sql:88`, `scripts/seed-admin-users.ts:228-229`) — will
  silently break or go stale on schema change.
