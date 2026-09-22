# Phase 5 — cancel/uncancel and edit guards (GitHub issue #15)

Status: **code complete, verifier PASS ×2, awaiting the user's browser pass (Half B).**
Baseline `d7d0a2c`, tree uncommitted. Nothing committed, staged, pushed, or deployed.

## What shipped

**New migration — `supabase/migrations/20260922120000_appointments_status_before_cancel.sql`**
Additive `appointments.status_before_cancel text NULL`, no backfill, with two named CHECKs:
`appointments_status_before_cancel_check` (domain `scheduled|in_progress|completed`, or NULL) and
`appointments_status_before_cancel_only_when_cancelled` (non-NULL only while `status='cancelled'`).
`'cancelled'` is excluded from the domain — a cancellation cannot have replaced a cancellation. The
domain deliberately still permits `'completed'` even though D-37 makes that value unreachable, because
the schema is not the place to encode a reversible application policy; the header says so.
DOWN SQL is in the header and was **executed successfully** against a freshly reset local database
during verification round 1, then UP re-applied. Header line 54 records that.

**`src/types/database.ts:309,327,345`** — `status_before_cancel` added to the appointments
Row/Insert/Update as `'scheduled' | 'in_progress' | 'completed' | null`, three-value union mirroring
the CHECK, nullable as the schema really is (constitution §9).

**`src/lib/actions/appointments.ts`**
- `:655-660` — edit guard extended to `cancelled`, a separate branch below the untouched `completed` one.
- `:730` — the form's cancel path writes the marker: `status_before_cancel` is set when the submitted
  status is `cancelled`, cleared otherwise. This is the *second* door into `cancelled`, which the
  original issue did not name.
- `:734` and `:744-763` — **amendment, see below**: the form's update is now compare-and-set on status,
  with a disambiguating re-read so a lost update reports "The appointment changed while you were
  editing it" instead of being misreported as "Appointment not found."
- `:766-816` — the `appointment_employees` delete-and-reinsert replaced by a reconcile. Rows are
  classified by `employee_id`, not by row; a surviving employee's rows are **never written at all**, so
  `id`, `clocked_in_at`, `clocked_out_at`, `admin_notes` and `is_archived` survive by construction.
  Read carries no `is_archived` filter (matching the delete it replaced); deletes are by `id`;
  duplicate `(appointment_id, employee_id)` rows are all-kept or all-deleted, never collapsed, because
  the table has no unique constraint on that pair and collapsing would itself be a silent delete.
  This was the highest-value change in the phase: the old code destroyed clock data on *every* edit of
  an ordinary `scheduled` appointment, not only a cancelled one, and it changed the row `id` that both
  `updateClockTime` and the `employee_clock` RPC address.
- `:976` — `cancelAppointment` hard-refuses a `completed` appointment (D-37), and separately refuses an
  already-`cancelled` one. The second refusal is load-bearing, not defensive: without it a double
  submit would write `status_before_cancel='cancelled'` and raise SQLSTATE 23514.
- `:986-991` — `cancelAppointment` records the replaced status and writes compare-and-set.
- `:1023-1049` — `uncancelAppointment` restores `status_before_cancel ?? 'scheduled'` and clears the
  marker in the same write, compare-and-set. NULL means "not recorded" and restores to `scheduled` —
  byte-for-byte today's behaviour for every legacy row, which is why no backfill was needed.

**`src/app/(internal)/solutions/(admin)/appointments/[id]/page.tsx`** — the Cancel control is hidden,
not disabled, when status is `completed`. Hidden because both `'use server'` wrappers at `:157-167`
discard the action's return value, so an error would be invisible and a disabled button would read as
broken.

**`src/app/(internal)/solutions/(admin)/appointments/[id]/edit/page.tsx:182-185`** — the amber
"cannot be edited" panel extended to `cancelled`, same shape and styling as the `completed` panel.

## REQ IDs closed

REQ-024, REQ-025, REQ-026, REQ-027 — all satisfied at the code-and-SQL-provable level. Their
browser-provable halves are pending the user's Half B pass. REQ-028 added at the drift gate (below).

## Deviations

1. **REQ-028 added after implementation (AMD-5 / D-42, 2026-09-22).** A `/code-review high` pass found
   that `updateAppointment`'s status write was not compare-and-set, so a concurrent mark-complete
   between its guard read at `:633` and its update was silently overwritten — the same lost-update
   class REQ-024/025 exist to close, reached through the form path. The plan had scoped that path to
   adding one field. The fix shipped and the requirement was written afterwards to match. It is a new
   REQ rather than a widening of REQ-024/025 because the guard covers *every* non-`series` edit, not
   only one that selects Cancelled.
2. **`cancelAppointment`'s completed-refusal was reworded** from "...Change its status first if this was
   recorded in error" to "...Completed is a final status." The original named a remedy the UI forbids.
   Wording only; no guard was relaxed. (D-43.)
3. **Accepted limitation KL-03.** The detail page's `'use server'` wrappers discard return values, so
   every error string this phase added on Cancel/Reopen is invisible — the admin sees a click that
   does nothing. Converting that page to a Client Component is out of scope per `05-CONTEXT.md §5`.
   This does **not** affect the edit page, where `appointment-form.tsx` renders `state.error`.

## Evidence

Verifier round 1 (full): static gate clean on the merged tree with zero delta from the pre-existing
6-error/19-warning lint baseline; `npm run build` clean — the first build against the merged tree;
E1-E4 all pass including all six CHECK-direction outcomes with SQLSTATE 23514 quoted from the server,
plus an executed and clean DOWN path; E3b confirms `appointments_employee_view` still returns exactly
13 columns with the new column absent (constitution §10); S1-S3 pass. Verifier round 2 (scoped to the
review fixes): PASS, zero static-gate delta, frozen contract and reconcile confirmed unregressed.

Both rounds returned BLOCKED/PASS on evidence grounds only — **no defect was ever found by either
verifier round.** Round 1's BLOCKED was purely that REQ-024/026/027 and REQ-025's behavioural half are
reachable only through the running app.

## Open for the user

- **OQ-C3 — the one real decision.** A mistakenly-completed appointment now has no escape hatch:
  it cannot be edited (pre-existing guard), cannot be cancelled (D-37 plus the hidden control), and
  cannot be reopened (Reopen applies only to `cancelled`). Cancel → Reopen *was* that hatch and this
  phase closes it without a replacement, leaving a wrongly-completed appointment billable on the next
  invoice. No default applied, no fix designed. This reads as minor and is not.
- **OQ-C1** (refuse vs. record-and-restore on cancelling a completed appointment) and **OQ-C2**
  (whether Reopen names the status it restores to) remain open with defaults applied.
- **Half B**, the 12-step browser script in `05-02-PLAN.md`, is the only evidence path for the
  behavioural half of all four original requirements.

## Deploy order — D-40, load-bearing

The migration ships **first or in the same release as the code, never the code alone.** Code-first is
worse than the bug it fixes: `cancelAppointment` would send a column that does not exist, PostgREST
would answer `400 / 42703`, and the detail page discards the result — Cancel would silently do nothing.
Nothing in the tree enforces this but this line.
