# 01-CONTEXT — Pricing foundation

Revised 2026-09-18 against the human's answers. **This phase was reshaped, not edited** — ARCH-1
came back as "replace by rename, no recalculation", which changes the migration's shape, and
ARCH-5 came back as "mask job rates from employees", which added a whole task.

## Goal

Land the schema, the hand-written types, the seeds, the pure money/resolution module, and the
employee visibility lockdown. **No admin-facing screen reads any of it when this phase closes.**
That is deliberate: the phase can be reviewed on its own.

## Decisions this phase is executing against

All human-confirmed 2026-09-18. Full reasoning in `STATE.md` Decisions.

- **ARCH-1 = replace, by rename (D-09).** `jobs.base_price_cents` → `jobs.hourly_rate_cents`,
  value carried across **verbatim**. No division by duration. No recalculation. No compensating
  conversion. A job at `12000` becomes **$120.00/hour**. There is **no `pricing_mode`** anywhere.
  If this looks like a mistake to you, it is not — it is the human's explicit choice, made knowing
  it changes every job's effective total price. Do not "fix" it.
- **ARCH-2 = hybrid freeze (D-10, D-11).** Canonical frozen line on `invoice_appointments`; a
  denormalized read-only copy on the new `appointments.billed_price_cents`.
- **ARCH-3 = B (D-12).** `effective_from` only. Newest applicable rule wins.
- **ARCH-4 = A (D-13).** Scheduled times drive the charge. Clock data is never read for money.
- **ARCH-5 = (b), full confidentiality (D-21, superseding D-14).** Employees lose the ability to
  read *any* price: job rates, `client_job_pricing`, **and** `appointments.price_override_cents` /
  `appointments.billed_price_cents` — including on appointments they are assigned to. What a client
  is billed and what an employee is paid are separate numbers; the pay side is #11 and does not
  exist yet, so nothing replaces the hidden price on an employee screen. **`01-03-PLAN.md`, two
  sequential tasks: `01-03-T1` (migration B) → `01-03-T2` (the three employee route files).**
- **ARCH-6 = A (D-15).** Per visit-hour. Crew size never multiplies anything.
- **DET-4 = hourly-only (D-16).** `client_job_pricing` has no mode and no flat price.
- **B-01** — `invoice_appointments` cannot currently be UPDATEd; this phase repairs it first.

## The two prices — read this before writing any code

They are different things and conflating them is the defect this milestone exists to remove.

```
EFFECTIVE price  (live, derived, never stored on appointments)
  = appointments.price_override_cents                  if NOT NULL   source 'appointment_override'
  = round(rule.hourly_rate_cents  * minutes / 60)      if a rule applies, source 'client_job_pricing'
  = round(jobs.hourly_rate_cents  * minutes / 60)      otherwise,      source 'job'

"a rule applies" = the row in client_job_pricing for (appointment.client_id, appointment.job_id)
                   with is_archived = false and effective_from <= appointment.scheduled_date,
                   taking the greatest effective_from. Ties are impossible (UNIQUE).

minutes = scheduled_end_time - scheduled_start_time, whole minutes.
          Always strictly positive: appointments.ts:235-243,348-356 reject end <= start.

BILLED price  (frozen at invoice time, stored twice)
  canonical : invoice_appointments.billed_amount_cents  -- source of truth for invoices.total_cents
  cache     : appointments.billed_price_cents           -- display only, NULL until invoiced

DISPLAYED price of an appointment
  = appointments.billed_price_cents   if NOT NULL   ("Invoiced", frozen)
  = EFFECTIVE price                   otherwise     (live)
```

`billed_price_cents` is **never** an input to `resolveAppointmentPrice`. The resolver must not be
able to see it; that is why it is not on `JobPricing` or on the resolver's input type at all.

## The exact schema this phase creates

Two migrations. The timestamps are ordinary Supabase CLI names — if the wall clock has moved on,
use the current UTC timestamp in the same `YYYYMMDDHHMMSS_` form; nothing depends on the literal
value except that migration A sorts before migration B.

### Migration A — `20260918120000_hourly_pricing_and_client_job_pricing.sql` (01-01-T1)

**jobs**
```sql
ALTER TABLE public.jobs RENAME COLUMN base_price_cents TO hourly_rate_cents;
-- stays: integer NOT NULL. Every stored value carried across untouched.
ALTER TABLE public.jobs ADD CONSTRAINT jobs_hourly_rate_cents_check CHECK (hourly_rate_cents >= 0);
COMMENT ON COLUMN public.jobs.hourly_rate_cents IS
  'Rate charged per scheduled hour. 2026-09-18: renamed from base_price_cents, which was a flat
   per-visit price. Values were NOT recalculated -- a job that charged $120.00 per visit now
   charges $120.00 per hour. Deliberate business reinterpretation, approved by the owner.';
COMMENT ON COLUMN public.jobs.estimated_duration_minutes IS
  'Scheduling hint only. Never used to compute money.';
```
Backfill: **none.** No stored number changes. Only its meaning does.

`estimated_duration_minutes` is kept (D-18) and stays nullable.

**client_job_pricing** (new)
```
id                uuid PK DEFAULT gen_random_uuid()
client_id         uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE
job_id            uuid NOT NULL REFERENCES jobs(id)    ON DELETE CASCADE
hourly_rate_cents integer NOT NULL             -- CHECK (hourly_rate_cents >= 0)
effective_from    date    NOT NULL
notes             text    NULL
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
is_archived       boolean NOT NULL DEFAULT false
UNIQUE (client_id, job_id, effective_from)
INDEX  (client_id, job_id, effective_from DESC)
TRIGGER set_updated_at BEFORE UPDATE
```
No `pricing_mode`. No `flat_price_cents`. No `effective_to`.
RLS enabled; `"Admin full access on client_job_pricing"` copying the exact shape of
`"Admin full access on jobs"` (`20260427000000_schema_snapshot.sql:562`); **no employee policy, no
anon policy** — with a comment saying so and why. `GRANT ALL TO anon, authenticated, service_role`
per the schema-wide convention (`01-RESEARCH.md §7`); RLS is the only gate.

**invoice_appointments**
```
created_at          timestamptz DEFAULT now()      -- repairs B-01, MUST be added FIRST
updated_at          timestamptz DEFAULT now()      -- repairs B-01, MUST be added FIRST
is_archived         boolean NOT NULL DEFAULT false
billed_amount_cents integer                        -- SET NOT NULL after backfill
billed_rate_cents   integer NULL
billed_minutes      integer NULL
CHECK invoice_appointments_billed_shape_check:
      (billed_rate_cents IS NULL) = (billed_minutes IS NULL)
```
No `billed_pricing_mode` (D-17). `billed_minutes IS NULL` **means** the line is a flat amount.

Backfill, as one UPDATE joining `appointments` and `jobs`:
```
billed_amount_cents = COALESCE(a.price_override_cents, j.hourly_rate_cents, 0)
billed_rate_cents   = NULL
billed_minutes      = NULL
```
`j.hourly_rate_cents` is the *renamed* column, so this number is bit-for-bit the amount the app
charged before the migration (`price_override_cents ?? base_price_cents ?? 0`). **Constitution §7
applies here in full** — the ARCH-1 carve-out covers the reinterpretation of *future* pricing only;
no historical invoiced amount may move.

Then one defensive UPDATE setting `billed_amount_cents = 0` where it is still NULL (should touch
zero rows — both FKs are `ON DELETE CASCADE`, `:505,510` — but `SET NOT NULL` must not be able to
fail), then `ALTER COLUMN billed_amount_cents SET NOT NULL`, then the CHECK.

**appointments**
```
billed_price_cents integer NULL
COMMENT: 'Denormalized copy of this appointment''s invoice_appointments.billed_amount_cents.
          NULL = not invoiced; use the live derived price. Display cache only -- never an input
          to price resolution (src/lib/pricing/resolve.ts) and never pre-fills the manual
          override field. Written only by createInvoice/updateInvoice.'
```
Backfill, **after** the junction backfill:
```sql
UPDATE public.appointments a
   SET billed_price_cents = ia.billed_amount_cents
  FROM public.invoice_appointments ia
 WHERE ia.appointment_id = a.id;
```
Known side effect: `appointments` carries a `set_updated_at BEFORE UPDATE` trigger
(`20260427000000_schema_snapshot.sql:436`), so this bumps `updated_at` on every invoiced
appointment. No screen reads that column; accepted. State it in the migration comment rather than
disabling the trigger.

**DOWN SQL** in the header comment block, and actually executed once against a reset DB to prove it
parses and succeeds: drop `appointments.billed_price_cents`; drop the three `billed_*`/CHECK and
the three housekeeping columns on `invoice_appointments`; drop `client_job_pricing`; drop
`jobs_hourly_rate_cents_check`; `ALTER TABLE public.jobs RENAME COLUMN hourly_rate_cents TO
base_price_cents`. The rename is what makes this reversible without a data export — that is why
`RENAME COLUMN` and not drop-and-add.

### Migration B — `20260918130000_restrict_employee_price_visibility.sql` (01-03-T1)

> **Widened 2026-09-18 (D-21).** ARCH-5 came back as option **(b), full confidentiality**: employees
> see no billed price at all, including on their own appointments. Migration B therefore carries
> **two** view rewrites, not one, plus the repair in part 3. It was renamed from
> `..._restrict_employee_job_visibility.sql` because it is no longer only about jobs.

Four parts, in this order. Read
`supabase/migrations/20260917120000_secure_appointment_employees_view.sql` end to end first and
follow it statement for statement — it is the reference implementation and its comment blocks
explain each step's reason.

**Part 1 — jobs**
```sql
DROP POLICY IF EXISTS "Employee select jobs" ON "public"."jobs";

CREATE OR REPLACE VIEW "public"."jobs_employee_view" WITH ("security_invoker"='false') AS
 SELECT "id", "name", "description", "is_archived"
   FROM "public"."jobs"
  WHERE (NOT "is_archived");

ALTER VIEW "public"."jobs_employee_view" OWNER TO "postgres";
COMMENT ON VIEW ...;
REVOKE ALL ON TABLE "public"."jobs_employee_view" FROM "anon";
REVOKE ALL ON TABLE "public"."jobs_employee_view" FROM "authenticated";
REVOKE ALL ON TABLE "public"."jobs_employee_view" FROM "service_role";
GRANT SELECT ON TABLE "public"."jobs_employee_view" TO "authenticated";
GRANT SELECT ON TABLE "public"."jobs_employee_view" TO "service_role";
```

**Part 2 — appointments** (new, D-21)
```sql
DROP POLICY IF EXISTS "Employee select assigned appointments" ON "public"."appointments";

CREATE OR REPLACE VIEW "public"."appointments_employee_view" WITH ("security_invoker"='false') AS
 SELECT "id",
    "client_id",
    "job_id",
    "recurrence_series_id",
    "scheduled_date",
    "scheduled_start_time",
    "scheduled_end_time",
    "status",
    "notes",
    "created_at",
    "updated_at",
    "is_archived",
    "location_id"
   FROM "public"."appointments"
  WHERE ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text") OR ("id" IN ( SELECT "public"."get_employee_appointment_ids"() AS "get_employee_appointment_ids")));

ALTER VIEW "public"."appointments_employee_view" OWNER TO "postgres";
COMMENT ON VIEW ...;
REVOKE ALL ON TABLE "public"."appointments_employee_view" FROM "anon";
REVOKE ALL ON TABLE "public"."appointments_employee_view" FROM "authenticated";
REVOKE ALL ON TABLE "public"."appointments_employee_view" FROM "service_role";
GRANT SELECT ON TABLE "public"."appointments_employee_view" TO "authenticated";
GRANT SELECT ON TABLE "public"."appointments_employee_view" TO "service_role";
```

The thirteen columns above are the **complete** list — `price_override_cents` and
`billed_price_cents` are the two that are deliberately absent, and they are the whole point of the
view. The list is explicit and must stay explicit: a `SELECT *` view would silently inherit
`billed_price_cents` the moment migration A adds it, which is exactly the leak this closes
(constitution §10). Conversely `job_id` and `location_id` are present on purpose even though the
current queries do not name them — T2's fallback path needs them, and having them here means a
fallback costs no schema change and no edit to this migration.

The row filter is copied verbatim from the dropped policy (`:574`), including its admin branch, so
the visible row set does not move. It must live **inside the view body**: the caller has no SELECT
policy on the base table any more, so definer rights would otherwise turn a column restriction into
a full-table read.

**Part 3 — the `client_locations` policy repair** (this is the part that is easy to miss)
`"Employee select locations for assigned appointments"`
(`20260427000000_schema_snapshot.sql:586-588`) has a `USING` clause that reads
`FROM public.appointments a`. Postgres applies the referenced table's RLS inside a policy
expression, so the moment part 2 drops the employee policy on `appointments`, that subquery returns
**zero rows for every employee** and employees lose the location address they see today. See
`01-RESEARCH.md §12b`. Repair it in the same migration, with the same row set:

```sql
CREATE OR REPLACE FUNCTION "public"."get_employee_location_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT a.location_id
    FROM public.appointments a
    WHERE a.location_id IS NOT NULL
      AND a.id IN (SELECT public.get_employee_appointment_ids());
$$;

ALTER FUNCTION "public"."get_employee_location_ids"() OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."get_employee_location_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_location_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_location_ids"() TO "service_role";

DROP POLICY IF EXISTS "Employee select locations for assigned appointments" ON "public"."client_locations";
CREATE POLICY "Employee select locations for assigned appointments" ON "public"."client_locations"
  FOR SELECT TO "authenticated"
  USING (("id" IN ( SELECT "public"."get_employee_location_ids"() AS "get_employee_location_ids")));
```
This mirrors `get_employee_appointment_ids()` (`:50-67`) exactly, which is the codebase's own
convention for "a policy needs to read a table the caller cannot". Keep the `GRANT ALL ... TO anon`
line: the function resolves the employee from `auth.uid()`, so an anonymous caller matches nothing,
and **revoking `EXECUTE` from `PUBLIC` crashes the Supabase Postgres 17.6 image with SIGSEGV**
(`01-RESEARCH.md §6`, and the comment at `20260917120000_*:122-130`).

**Part 4 — DOWN SQL** in the header comment block, verified by running it once against a reset DB.
Order matters, because the policy depends on the function:
1. `DROP POLICY "Employee select locations for assigned appointments" ON public.client_locations;`
   then re-create it **verbatim** as it appears at `20260427000000_schema_snapshot.sql:586-588`.
2. `DROP FUNCTION public.get_employee_location_ids();`
3. `DROP VIEW public.appointments_employee_view;` and `DROP VIEW public.jobs_employee_view;`
4. Re-create `"Employee select assigned appointments"` verbatim from `:574` and
   `"Employee select jobs"` verbatim from `:582`.

The `REVOKE ALL` in parts 1 and 2 is not optional and not cosmetic: a definer view left with the
default `GRANT ALL` is auto-updatable and would let any authenticated user write to the base table
through it. That exact bug is what `20260917120000_*:40-65` fixed for `employees_employee_view`.

**Migration B still has no work-time dependency on migration A.** Both views name their columns
explicitly and neither names a renamed or new column, so B applies whether or not A has run. Only
the timestamp ordering matters.

## Cross-task type contract

`src/types/database.ts` is owned exclusively by **01-01-T1**, including the `Views` entries for the
two views 01-03-T1's migration creates. That is the one place the tasks meet, and it is settled here
so neither waits on the other:

```ts
jobs_employee_view: {
  Row: {
    id: string
    name: string
    description: string | null
    is_archived: boolean
  }
}

appointments_employee_view: {
  Row: {
    id: string
    client_id: string
    job_id: string
    recurrence_series_id: string | null
    scheduled_date: string
    scheduled_start_time: string
    scheduled_end_time: string
    status: string
    notes: string | null
    created_at: string | null
    updated_at: string | null
    is_archived: boolean | null
    location_id: string | null
  }
}
```
Views get a `Row` only, matching `appointment_employees_employee_view` at `src/types/database.ts:341-366`.
Nullability is taken from the base table DDL (`20260427000000_schema_snapshot.sql:160-178`):
`created_at`, `updated_at` and `is_archived` carry defaults but are **not** declared NOT NULL, so
they are nullable — type them to the real column, not the convenient one (constitution §9).
Neither `Row` contains `price_override_cents` or `billed_price_cents`; if either appears in
`database.ts` under a `*_employee_view` entry, the type is lying about a view that does not expose
it and REQ-020 has been broken.

## Open questions answered by existing code (not asked of the human)

- *"Is there anywhere else that computes a price?"* — No. No SQL function, view, or RLS policy in
  any migration references `base_price_cents`, `price_override_cents`,
  `estimated_duration_minutes`, or the time columns. The TypeScript sites in `01-RESEARCH.md §4`
  are the complete set.
- *"Can an appointment be on two invoices?"* — No.
  `invoice_appointments_appointment_id_key` (`:352`). So "the frozen price of this appointment" is
  unambiguous and `billed_price_cents` can be a scalar.
- *"Is there a hard-delete path for invoices?"* — No. `src/lib/actions/invoices.ts` has exactly one
  `.delete()` (line 380), on the junction inside `updateInvoice`. Invoices are voided and archived,
  never deleted. That is what makes `billed_price_cents`'s write path closed.
- *"Can a scheduled duration be zero or negative?"* — No
  (`src/lib/actions/appointments.ts:235-243,348-356`).

## Hard prohibitions for this phase

- No `supabase db push`, no `supabase link`, no touching `blhxzilsjuzbeoxtkbap`.
- No `git commit`, no `git add`.
- **No edits under `src/app/(internal)/solutions/(admin)/`, `src/components/admin/`, or
  `src/lib/actions/`** — Phases 2 and 3 own every one of those files, and four concurrent tasks
  will collide with you. If the rename appears to require an edit there, it does not: see D-19,
  that breakage is expected and belongs to Phase 2.
- No new npm dependency.
- Do not "fix" an invoice whose `total_cents` disagrees with the sum of its lines. Report it.
- Do not add a compensating conversion to the rename. Do not divide by
  `estimated_duration_minutes`. Anywhere.
