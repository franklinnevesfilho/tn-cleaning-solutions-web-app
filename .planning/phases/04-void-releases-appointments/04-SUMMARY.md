# Phase 4 — Voiding an invoice releases its appointments (REQ-022 / GitHub issue #18)

**Status:** code complete, verified against a live local stack 2026-09-21. Half B (the user's
browser pass) outstanding. Baseline `926f088`; tree uncommitted per constitution §6.

## What shipped

| File | Change |
|---|---|
| `supabase/migrations/20260921130000_void_releases_appointments.sql` (new) | `CREATE UNIQUE INDEX invoice_appointments_live_appointment_id_idx ON invoice_appointments (appointment_id) WHERE (is_archived = false)`, then `DROP CONSTRAINT invoice_appointments_appointment_id_key`. No backfill. DOWN executed and verified (E6). |
| `src/types/database.ts:512` | `isOneToOne: true` → `false` on `invoice_appointments_appointment_id_fkey` (§9). |
| `src/lib/actions/invoices.ts` | `voidInvoice`: status → release → clear. Release is one `UPDATE ... WHERE invoice_id = $1 AND is_archived = false RETURNING appointment_id`; the returned ids feed the `billed_price_cents` clear. |
| `supabase/checks/pricing_backfill_check.sql` | Both cache invariants narrowed to live junction rows (`is_archived = false`) in the same edit; both labels gained *live*. |
| invoice builder pages (`new/page.tsx:71`, `[id]/edit/page.tsx:88`) | Junction reads filter `is_archived = false`. The per-invoice read at `edit/page.tsx:81-83` is deliberately unfiltered (DET-V1). |

Review-driven hardening, same file:

| Change | Why |
|---|---|
| `clearBilledPriceCache` returns `boolean`; `voidInvoice` surfaces a failed clear as `success: false` with its own message | A swallowed clear leaves a released appointment carrying a stale "Invoiced" chip — the exact row the newly narrowed invariant asserts must be 0. Supersedes DET-V5's last sentence, which was written when the clear was cosmetic. |
| Compare-and-set status guards on `voidInvoice` (`.in('status',['draft','issued'])`), `issueInvoice` (`.eq('status','draft')`), `markInvoicePaid` (`.eq('status','issued')`), each with `.select('id')` and a zero-row check returning `invoiceChangedError` | Without them, two admins racing could leave a **paid** or **issued** invoice whose appointments were released and billable again — money collected, then billed a second time. Pre-Phase-4 the same race produced only a wrong status with nothing released. |

## REQ IDs closed

REQ-022(a), (b), (c), (d) and its check-script clause — all satisfied, verified. REQ-002 and
REQ-018 as amended (AMD-3, AMD-3b, AMD-4) are consistent with the shipped diff. No drift: every
source change maps to a REQ except the CAS hardening, recorded as a deviation below.

## Evidence

- **E1** fresh DB: old constraint 0, partial index with the right predicate 1, PK 1, `is_archived` NOT NULL 1, released rows 0, cached prices 0.
- **E3** second *live* row for the same appointment rejected: `duplicate key value violates unique constraint "invoice_appointments_live_appointment_id_idx"` (23505). The double-billing guard survived the constraint drop.
- **E4** after release, the same insert succeeds; count for that appointment is 2. **E4b** a same-`(invoice_id, appointment_id)` insert still hits `invoice_appointments_pkey`.
- **§7** junction row md5 `45403b8a22835875f488d0233ebf7bbb` before and after the release; `total_cents` 6000 both times.
- **E5** discriminating **0 → 1 → 0**; the old script read `0 (ok)` on the same state, so the narrowing demonstrably narrowed.
- **E6** both DOWN statements succeeded against a reset database; E1 inverted.
- **Round 2**, real `invoices.ts` bundled and run against the live DB with an interleaving harness: 25 pay+void and 25 issue+void `Promise.all` pairs produced no paid-or-issued invoice with released rows (DB-wide query = 0 across 64 invoices). void-then-issue correctly does *not* raise a spurious `invoiceChangedError`.
- `tsc` 0, `eslint` on changed files 0, `npm test` 17/17, `npm run build` 0.

## Deviations from plan

1. **CAS guards on `issueInvoice` and `markInvoicePaid` are outside REQ-022 as approved.** Included because closing the race needs every writer of `invoices.status`, not only `voidInvoice`. Flagged to the user as a spec amendment.
2. **DET-V5 superseded** on the cache-clear failure path (see table above).
3. **OQ-V1 unanswered — forward-only.** The migration releases nothing retroactively, so every invoice voided before deploy keeps its appointments permanently unbillable. The sizing query and remediation SQL ship commented in the header, executed never. Requires a named, dated human-approved §7 exception to run.

## Accepted residual risk

`updateInvoice` × `voidInvoice` interleaving is **not** closed; `updateInvoice` was out of scope and
closing it needs a transaction/RPC or post-write compensation. All four insertion points were
simulated. Three degrade to the pre-Phase-4 state (void invoice, live rows, no double-billing — the
live unique index still holds). The fourth writes a stale `billed_price_cents` onto a released
appointment: display-only, trips section 3's invariant, self-heals on re-invoice, and never
misbills. Shipped as accepted risk; follow-up is to guard `updateInvoice`'s junction writes on
status.

Also standing, not from this phase: `npm run lint` exits 1 at the `926f088` baseline with 6 errors
/ 19 warnings, all in files no Phase 4 task touched. Constitution §16 asks for a clean lint, so the
gate cannot go green on this tree until someone rules on it.

## Deploy order (§7.0b, D-33)

The migration ships **first or in the same release as the code, never the code alone** — code-first
is exactly the half-fix REQ-022 forbids.
