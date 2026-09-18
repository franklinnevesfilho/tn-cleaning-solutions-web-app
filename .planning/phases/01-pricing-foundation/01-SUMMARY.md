# 01-SUMMARY — Pricing foundation

**Status**: COMPLETE, verified 2026-09-18. Nothing committed; `git log -1` is still `7ae55f5`.

## What shipped

| Task | Files | Outcome |
|---|---|---|
| `01-01-T1` | `supabase/migrations/20260918120000_hourly_pricing_and_client_job_pricing.sql`, `src/types/database.ts`, `supabase/checks/pricing_backfill_check.sql` | `jobs.base_price_cents` → `hourly_rate_cents` by RENAME, values untouched (D-09). `client_job_pricing` created, admin-policy-only. `invoice_appointments` gained `created_at`/`updated_at`/`is_archived` (B-01) then the three `billed_*` columns, backfilled, `NOT NULL`, shape CHECK. `appointments.billed_price_cents` added and backfilled. |
| `01-01-T2` | `scripts/seed-admin-users.ts`, `supabase/test-data.sql` | Hard host guard (`127.0.0.1`/`localhost` only, fails closed). Every write's error checked; exits non-zero on any failure or skip; logs its resolved host; reads back what it claims to have created. Seeds retargeted to hourly rates, second job + one client rule added. |
| `01-02-T1` | `src/lib/pricing/{money,resolve,lookup}.ts`, `tests/pricing/*`, `package.json`, `tsconfig.json` | One money module, one `Intl.NumberFormat`, precedence override → client rule → job. 17/17 tests. |
| `01-03-T1` | `supabase/migrations/20260918130000_restrict_employee_price_visibility.sql` | Both employee SELECT policies dropped; `jobs_employee_view` and `appointments_employee_view` as `security_invoker=false` definer views with explicit column lists and `REVOKE ALL` + `GRANT SELECT`; `get_employee_location_ids()` added and the `client_locations` policy repaired (B-06). |
| `01-03-T2` | the three `src/app/(internal)/solutions/(employee)/` route files | Six changed lines, all PostgREST aliases (`appointments:appointments_employee_view!inner`, `jobs:jobs_employee_view!inner`). Nothing rendered changed. |

## Requirements closed

REQ-001, REQ-002, REQ-003, REQ-005, REQ-006 (schema half), REQ-007, REQ-008, REQ-009, REQ-010,
REQ-011, REQ-017 (as rewritten), REQ-018 (schema half), REQ-019, REQ-020, REQ-016 (nothing
committed). REQ-004 and REQ-021 belong to Phase 2 and are open.

## Blockers resolved

- **B-01** — fixed and proven in both directions on a real row.
- **B-05 / AS-10** — resolved **favourably and empirically**. PostgREST infers the two-level
  view→view embed chain and the `clients` / `client_locations` embeds off a view. The JS-stitching
  fallback the plan carried was **not needed and is not used**; the employee screens cost the same
  number of round trips as before.
- **B-06** — repaired; the employee still sees the job-site address.
- **B-07** — closed; the seed now fails loudly and proves itself by read-back.
- **B-04** — still open, and is a **human step**: run `pricing_backfill_check.sql` against a restore
  of production before deploying.

## Deviations from plan

1. **`01-01-T1`, `01-03-T1` and most of `01-01-T2` were already on disk** when this session resumed;
   `STATE.md` described them as in-flight or not started. Disk won, per the reconcile rule. Only
   `supabase/test-data.sql` was genuinely outstanding.
2. **One defect found during verification that no plan anticipated, and fixed in scope.**
   `appointment_employees` has no unique constraint on `(appointment_id, employee_id)`, so the seed
   script's `code === '23505'` branch was unreachable and each run duplicated an assignment — the
   seed was not idempotent, and this is the same mechanism behind the production incident's
   duplicate row. Fixed with the read-before-insert pattern already used elsewhere in the file. The
   **missing constraint itself was left alone** — adding it is a schema decision outside this
   milestone's requirements.
3. **The seed guard was proven against a dummy remote host, not against the real production URL.**
   Running the script with the production `.env.local` was blocked by the environment's own
   safety classifier. The guard runs before any client is constructed and rejects any host outside
   `['127.0.0.1','localhost']`, so the production hostname takes the identical path — but the
   literal "point it at production and watch it refuse" run was not performed, by design.

## Known state of the tree

Phase 1 ships **ahead of its call sites**, deliberately (D-19). `tsc`, `lint` and `build` all pass,
and roughly 57 `base_price_cents` call sites across ~21 files are still broken **at runtime** — a
PostgREST `42703`/400 on live admin pages. That is Phase 2's work, and per D-22 it has no compiler
safety net: the sweep is grep-driven and must be proven by loading each affected route in a browser.
