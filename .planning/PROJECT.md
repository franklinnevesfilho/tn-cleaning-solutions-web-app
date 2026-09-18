# PROJECT — Hourly job pricing + per-client negotiated rates

Milestone for GitHub issue #10 (`franklinnevesfilho/web-app`).
Baseline: branch `improved-appointments`, commit `7ae55f5`.
Reference: `.planning/CODEBASE-MAP.md` (structure + pricing blast radius, verified against live files 2026-09-18).

## Vision

TN Cleaning Solutions prices work by the hour, not by a flat per-job fee, and long-standing
customers have negotiated rates that must survive across every future appointment and invoice.

Today the app has neither concept. `jobs.base_price_cents` is a single flat amount
(`supabase/migrations/20260427000000_schema_snapshot.sql:290`), and the only per-appointment
adjustment is `appointments.price_override_cents` (`:168`) — a one-off flat number retyped on
every appointment and silently back-written by the invoice builder
(`src/lib/actions/invoices.ts:185-194`).

After this milestone:

- **Every job is hourly.** `jobs.base_price_cents` is renamed to `hourly_rate_cents` and its stored
  value is carried across untouched, so a job that charged a flat $150 per visit now charges $150
  per hour. That is the owner's explicit decision (ARCH-1, 2026-09-18), taken over the alternative
  of dividing by the estimated duration to preserve each job's current total. There is **no
  pricing-mode toggle** anywhere in the system.
- A `client_job_pricing` row can override a job's hourly rate for one client, from a given date
  forward, with the history of previous rates preserved.
- The amount charged for an appointment is **derived** from one resolver
  (`override → client rule → job rate`) and is **frozen onto the invoice line**
  (`invoice_appointments.billed_amount_cents`) when the invoice is built — with a read-only copy on
  `appointments.billed_price_cents` so the admin appointment list shows real per-visit cost.
- **Employees can no longer read any price — full stop.** Not a job's rate, not a client's
  negotiated rate, and not the price of an appointment they are personally assigned to. Both
  `"Employee select jobs"` and `"Employee select assigned appointments"` are replaced by
  column-restricted `security_invoker=false` views (ARCH-5 = (b), 2026-09-18). This is a change to
  live behaviour on three employee screens, and nothing replaces the hidden figures (KL-02).
- Money math lives in one module with real regression tests.

## Constraints

- **Live production database** (Supabase ref `blhxzilsjuzbeoxtkbap`). Migrations are authored and
  verified locally only. No `supabase db push` anywhere in this plan; deploying is a human step.
- **No commits.** The human reviews the working tree.
- `src/types/database.ts` is hand-written with no generator and **existing drift** — it types
  `jobs.description`/`jobs.estimated_duration_minutes` as non-nullable when the columns are
  nullable, and types `created_at`/`updated_at`/`is_archived` on `invoice_appointments`
  (`src/types/database.ts:317-338`) when **those columns do not exist**.
- **No test harness of any kind exists.** No vitest/jest, no `*.test.*` file in the repo.
  Node is v25.8.1, which runs TypeScript directly, so `node --test` is used with zero new
  dependencies (verified working in this environment).
- Three seed paths must keep working: `supabase/seed.sql`, `supabase/test-data.sql:85-100`,
  `scripts/seed-admin-users.ts:222-232`.
- No validation library, no shared money helper, no middleware. Auth gating lives in server
  component layouts and in per-file `requireAdminRole()`.
- Next.js is **stock `next@16.2.4` / `react@19.2.4`** — `AGENTS.md`'s "this is NOT the Next.js
  you know" banner is not supported by the vendored docs (see `01-RESEARCH.md`). The project
  rule to consult `node_modules/next/dist/docs/` before writing framework code still stands.

## Success metrics

1. An admin can set a job's rate to $X/h, schedule a 2h30m appointment, and see the invoice bill
   exactly `round(X_cents * 150 / 60)`.
2. An admin can record "Client A pays $38/h for Deep Clean from 2026-10-01" and every appointment on
   or after that date prices at $38/h, while appointments before it do not.
3. `supabase db reset` on a copy of production data changes **zero stored money values** and
   **zero historical invoice totals** — and `supabase/checks/pricing_backfill_check.sql` reports,
   per job and per un-invoiced appointment, exactly how far the *derived* price moved, so the owner
   can see the blast radius of the reinterpretation before deploying.
4. An employee signed in to `/solutions/schedule` sees their work and no rate, anywhere.
5. `npm test` covers rounding, precedence, and effective-date selection.

> Metric 3 was rewritten on 2026-09-18. It previously read "changes zero existing appointment
> prices", which ARCH-1's answer falsified by design: every un-invoiced appointment's price moves.
> What survives, and what still matters, is that nothing is *silently* changed or corrected —
> stored amounts are untouched and the movement is reported.

## Non-goals (explicit)

- **#11 employee→job payroll rates.** A `employee_job_rates` table is a *separate, parallel*
  concept. Not in scope, not designed here, not stubbed.
- **#12 automated invoicing.** No scheduled generation, no auto-drafting, no emailing.
  This milestone must not foreclose it — freezing per-line amounts on
  `invoice_appointments` is precisely the groundwork #12 needs — but it builds none of it.
- **No full `invoice_line_items` table.** The three `billed_*` columns on the existing junction are
  the minimum that freezes a line. A first-class line-item table (ad-hoc lines, discounts, taxes)
  belongs to #12 if it is ever needed.
- **No flat pricing of any kind on `jobs` or `client_job_pricing`.** One hourly rate each. The only
  flat amount left is `appointments.price_override_cents`, a manual per-visit override.
- **No tax, no discount percentages, no currencies other than USD.**
- **No change to `estimated_duration_minutes`.** It stays an advisory scheduling estimate and is
  never used to compute money — including in the ARCH-1 backfill, which does not divide by it.
- **KL-01 — no per-client *flat* quote as a standing rule.** There is no way to record "Client A
  pays a fixed $200 for Deep Clean however long it takes". Every standing price in the system is an
  hourly rate multiplied by scheduled minutes: `jobs.hourly_rate_cents` (D-09) or a
  `client_job_pricing.hourly_rate_cents` override (D-16). The workaround is
  `appointments.price_override_cents`, retyped per visit — real, but exactly the retyping issue #10
  set out to reduce. The reversal is **purely additive** (a nullable `flat_price_cents` plus a
  `pricing_mode text NOT NULL DEFAULT 'hourly'`, which backfills every existing row to its current
  meaning with no value changed), so nothing here forecloses it. Full statement, including the
  five-step reversal path and what would promote it to a requirement: `REQUIREMENTS.md`
  "Known limitations".
- **KL-02 — no earnings figure for employees, at all.** ARCH-5 = (b) removes every price an employee
  could reach and puts **nothing** in its place: no placeholder, no estimated earnings, no "pay
  TBD". What a client is billed and what an employee is paid are different numbers, and the pay side
  is issue #11, which does not exist. "The employee schedule shows no money anywhere" is the
  designed outcome, not a regression.
- **No PDF/print/email of invoices. No client-facing portal.** There is no client auth role.
- **No deployment, no commit, no PR.** The reinterpretation in ARCH-1 reaches production only when
  a human runs the migration, after reading `pricing_backfill_check.sql`'s output.
