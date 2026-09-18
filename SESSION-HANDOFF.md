# Session handoff — 2026-09-18

Written because the account working on this repo is changing. Everything below is what a fresh
session needs to pick this up without re-deriving it.

## Where things stand, in one paragraph

User feedback was collected into GitHub issues #2, #8–#14. Four are closed and shipped
(#8, #9, #14, plus a drive-by bug-fix commit). #10 (job pricing restructure) is mid-implementation
with a full spec in `.planning/` and real but uncommitted code changes in the working tree — do
**not** commit or push any of it without reading `.planning/STATE.md` first, it is not done.
#11, #12, #13, #2 are untouched. A real production incident happened during #10's work (a seed
script wrote to the live database); the user has accepted the current state and declined cleanup —
see below, don't re-raise it as new.

## GitHub issues — repo `franklinnevesfilho/web-app`

| # | Title | Status |
|---|---|---|
| 8 | Un-cancel appointments + hide cancelled from calendar | **Closed.** Commit `1b22ef7`. |
| 9 | Employee fields (start date, address, e-transfer email) | **Closed.** Commit `8f97fdb`, migration `20260911170000` pushed to production. |
| 14 | Security: `admin_notes`/employee PII readable via views | **Closed.** Commit `7ae55f5`, migration `20260917120000` pushed to production. |
| 10 | Restructure jobs to per-hour pricing + customer-specific pricing | **Open, in progress.** See below. |
| 11 | Payroll view (date range, per-employee-per-job pay rates) | Not started. Depends conceptually on #10's pricing groundwork but is a separate employee-pay-rate concept. |
| 12 | Automate invoice creation + adjustable per-customer pricing | Not started. Depends on #10 (the `client_job_pricing` table and `invoice_appointments.billed_*` columns #10 is building are exactly what this needs). |
| 13 | Dashboard: pending/overdue/paid invoice stats | Not started. Fully standalone, quick win — `invoices_with_status` view already computes the `overdue` state, just needs UI. |
| 2 | Reset Password Flow | Not started. Pre-existing, unrelated to this feedback batch. |

Also closed along the way, not from the original feedback batch: a commit (`10c8334`) fixing two
unrelated bugs found by code review (invalid-date sort in time-tracking, an unbounded query
truncated by PostgREST's 1000-row cap) plus a Supabase migration-history reconciliation.

## Production incident (resolved, don't re-raise)

On 2026-09-18, `scripts/seed-admin-users.ts` (documented in `docs/local-setup.md` as a **local**
setup step, but with no environment guard) ran against the **live** Supabase project at least
twice during #10's implementation. It reset two account passwords to hardcoded defaults
(`admin123`, `employee123`) and overwrote two `employees` rows' `full_name`/`phone`/`is_active`
with seed constants, and inserted a duplicate `appointment_employees` row.

**User's decision, already given — do not re-litigate:** those two accounts
(`franklin.neves.filho@gmail.com`, `sarah.johnson@tncleaningsolutions.com`) are test accounts to
the user, so this was not treated as a credential emergency. The user explicitly declined cleanup
of the duplicate row and the clobbered employee fields. **No action needed here.** The one thing
that *is* still enforced going forward: no agent may run `npm run seed:admin` again until it has a
hard guard refusing any host but `127.0.0.1`/`localhost` — that guard is part of #10's in-flight
work (`01-01-T2` in the plan).

## #10 — current state, uncommitted

Full spec lives in `.planning/` (written by a `planner` agent, then twice revised against six
architecture decisions the user made directly — see `.planning/STATE.md` "Decisions" section for
the full reasoning trail, D-09 through D-22). **Read `.planning/STATE.md` first** — it is the
single source of truth for what's done, what's in flight, and what's next.

### The six architecture decisions the user made (summary — full reasoning in STATE.md)

1. **Single hourly rate, no flat/hourly mode toggle.** `jobs.base_price_cents` is renamed to
   `hourly_rate_cents`, value carried over unchanged (a job priced at $120 flat becomes $120/hour —
   deliberate, not a bug).
2. **Hybrid price freeze.** The invoice line (`invoice_appointments.billed_*`, new columns) is the
   source of truth for invoice totals. The appointment also gets its own `billed_price_cents`
   column, written once invoiced, purely so the appointment list can show real per-visit cost
   without two same-job appointments being ambiguous. Before invoicing, appointments show a live
   derived price.
3. **Client-specific pricing keeps dated history.** `client_job_pricing` rows carry
   `effective_from`; the newest rule on/before the appointment date wins. No retroactive repricing
   when a rate changes.
4. **Billing uses scheduled time, not clocked time.** `scheduled_end_time - scheduled_start_time`.
5. **Full price confidentiality from employees.** Not just "no rate-card browsing" — employees must
   not be able to derive what a client is billed even from their own assigned appointments (their
   pay is a separate, not-yet-built concept from #11). This is the widest-reaching decision; it
   required masking `appointments.price_override_cents`/`billed_price_cents` via views, not just
   `jobs`/`client_job_pricing`.
6. **Price is per visit-hour, not per employee-hour.** Crew size doesn't change the price.

### What's actually done vs. not, as of the stop

Uncommitted working-tree changes exist for:
- `supabase/migrations/20260918120000_hourly_pricing_and_client_job_pricing.sql` (new)
- `supabase/migrations/20260918130000_restrict_employee_price_visibility.sql` (new)
- `src/lib/pricing/` (new — `money.ts`, `resolve.ts`, `lookup.ts`)
- `tests/` (new — pricing unit tests, passing as of last check: 17/17)
- `supabase/checks/` (new — a read-only backfill-impact report script, **must be run against a
  production copy before deploying**, per `.planning/STATE.md` B-04)
- `package.json`, `tsconfig.json`, `src/types/database.ts`, `scripts/seed-admin-users.ts` (modified)

Phase 1 (foundation: migrations, pricing lib, seed-script guard) was near completion — Block 2
(eight concurrent tasks covering all `base_price_cents` call sites across the app) had just been
dispatched when the session was stopped. Phase 2 (wiring pricing into appointments/invoices UI) and
Phase 3 (admin UI for `client_job_pricing`) have plans written but no code yet.

**Nothing is committed. Nothing has been pushed. This is intentional per the plan — do not commit
until Phase 1's verification gate passes** (migrations apply cleanly locally, `npm test` green,
`npx tsc --noEmit` clean, seed script proven to refuse non-local hosts). Read
`.planning/STATE.md` → "Next action" for the precise resume point.

### Known limitations already decided, not bugs

- No standing per-client *flat* monthly quote is expressible anymore (`client_job_pricing` is
  hourly-only) — documented as KL-01 in `.planning/REQUIREMENTS.md`. Per-visit flat override via
  `price_override_cents` still works.
- Employees will see no earnings figure anywhere (KL-02) — that's #11's job, not #10's.

### A real latent bug found and being fixed as part of this work

`invoice_appointments` has an `updated_at` trigger referencing a column that doesn't exist — any
`UPDATE` on that table has always crashed (masked because the existing invoice code deletes +
re-inserts instead of updating). #10's pricing backfill needs to `UPDATE` that table, so fixing this
is a folded-in prerequisite (`.planning/STATE.md` B-01), not scope creep.

## Recommended order once resumed

1. Re-read `.planning/STATE.md` in full before doing anything else.
2. Resume/finish Phase 1's Block 2, then its verification gate.
3. Phase 2, then Phase 3, per `.planning/ROADMAP.md`.
4. Before any `supabase db push` to production: run `supabase/checks/pricing_backfill_check.sql`
   against a copy of production first (B-04) — nobody has measured how far real job prices move
   under decision #1 above.
5. After #10 ships: #12 (automated invoicing) is unblocked and should reuse the
   `client_job_pricing`/`invoice_appointments.billed_*` groundwork directly. #13 is a good
   standalone pick anytime. #11 is a separate, not-yet-designed employee-pay-rate feature.
