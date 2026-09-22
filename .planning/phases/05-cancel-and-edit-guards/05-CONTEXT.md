# 05-CONTEXT — Cancel/uncancel and edit-guard data loss

GitHub issue **#15**. Two related defects in code shipped by issue #8 (commit `1b22ef7`). Neither
was introduced by the #10 pricing milestone and neither is a consequence of it; both were found
while working on #10 and recorded then in `STATE.md` under the `/code-review high` triage
("Two real, NEW bugs in already-committed issue-#8 code … surfaced, deliberately not fixed here").

**Read this file before any task in this phase.** §5 records the three decisions an executor must
not improvise, §4 the facts about the tree that those decisions rest on, and §9 the standing
constraints that apply to every task.

---

## 1. What is being fixed, in one paragraph

An appointment's status is the only record that work happened. `cancelAppointment` will overwrite
**any** status, including `completed`, and `uncancelAppointment` restores to the literal string
`'scheduled'`, so *complete → cancel → reopen* erases the completion with nothing on screen saying
so. Separately, the server-side edit guard blocks only `completed`, so a cancelled appointment is
freely editable, and `updateAppointment` **deletes and re-inserts every `appointment_employees` row
on every edit** — which discards `clocked_in_at`, `clocked_out_at`, `admin_notes` and the row's
`id`. The second half of that is the wider bug: it fires on **any** edit of **any** appointment
whose crew has already clocked in, cancelled or not. This phase adds a persisted memory of the
status a cancellation replaced, refuses to cancel a completed appointment, extends the edit guard to
cancelled appointments, and replaces the delete-and-reinsert with a reconcile that leaves surviving
assignment rows untouched.

---

## 2. Facts established by reading the tree at `d7d0a2c`

Line numbers verified 2026-09-22. The issue's own line numbers have drifted; these have not.

1. **`cancelAppointment` — `src/lib/actions/appointments.ts:895-920`.** No status filter of any
   kind: `update({ status: 'cancelled' }).eq('id', id).eq('is_archived', false)`.
2. **`uncancelAppointment` — `:922-948`.** `update({ status: 'scheduled' })`, filtered
   `.eq('status', 'cancelled')`. The filter makes it a no-op on a non-cancelled row; it does
   nothing about *which* status to restore.
3. **The only server-side edit guard — `:648-653`.** `existingAppointment.status === 'completed'`.
   The row is read at `:633-638` selecting `id, client_id, recurrence_series_id, status`.
4. **The delete-and-reinsert — `:739-764`.** Unconditional
   `.delete().eq('appointment_id', id)`, then an insert of one row per submitted employee id with
   `admin_notes: ''`. It runs on every non-`series` edit scope, i.e. `occurrence` and `future`.
   It has **no `is_archived` filter**, so it deletes archived assignment rows too.
5. **`updateClockTime` — `:950-977`** writes `clocked_in_at` / `clocked_out_at` on
   `appointment_employees`, keyed on the assignment row's `id`
   (`src/components/admin/admin-clock-override.tsx:60`).
6. **Employees clock through `public.employee_clock`**
   (`supabase/migrations/20260917120000_secure_appointment_employees_view.sql:72-113`), a
   `SECURITY DEFINER` function keyed on `assignment_id` — the same `appointment_employees.id`.
   Delete-and-reinsert therefore does not merely blank the times, it **changes the identity of the
   row** every clock UI addresses.
7. **`appointment_employees` has no unique constraint on `(appointment_id, employee_id)`**
   (`20260427000000_schema_snapshot.sql:125-135`), a fact discovered during Phase 1 verification
   when the seed script was found to be non-idempotent. Duplicate rows for one employee on one
   appointment are therefore *possible*, and the reconcile in §5.3 is specified to preserve every
   one of them.
8. **The status domain is a table CHECK** — `appointments_status_check` over
   `('scheduled','in_progress','completed','cancelled')`, `20260427000000_schema_snapshot.sql:175`.
   `status text NOT NULL DEFAULT 'scheduled'` (`:169`).
9. **There is a second way into `cancelled`.** The edit form renders a full status `<select>` with
   all four values (`src/components/admin/appointment-form.tsx:307-324`), parsed and validated at
   `appointments.ts:313,350-358` and written at `:722`. So *scheduled → cancelled* and
   *in_progress → cancelled* can happen through `updateAppointment`, never touching
   `cancelAppointment`. **Any memory of the prior status has to be written on both paths or it is
   worse than none.**
10. **`completed` is already terminal for editing** at both layers — `appointments.ts:648` and
    `src/app/(internal)/solutions/(admin)/appointments/[id]/edit/page.tsx:178-181`, which renders an
    amber panel in place of the form. Consequently *completed → cancelled* through the **form** is
    already impossible; `cancelAppointment` is the only door.
11. **The detail page's Cancel / Reopen controls** —
    `src/app/(internal)/solutions/(admin)/appointments/[id]/page.tsx:157-167` (the two `'use server'`
    wrappers) and `:207-227` (the conditional: Reopen when `status === 'cancelled'`, Cancel in
    **every other case**, `completed` included). **Both wrappers discard the action's return
    value**, so a server-side refusal is invisible on that page today. That is why REQ-024 hides the
    control rather than relying on an error message.
12. **`appointments_employee_view` lists its columns explicitly**
    (`20260918130000_restrict_employee_price_visibility.sql:107-120`), so a new base-table column is
    **not** exposed to employees by adding it. Nothing in this phase changes that view; see §7.
13. **The invoice builders do not filter on appointment status** — `invoices/new/page.tsx:68,71,83`
    filters on `is_archived` only. A `scheduled` appointment can be invoiced, and can then be
    cancelled while still being billed. Pre-existing, **out of scope**, recorded in §8.
14. **`employee_ids` arrives de-duplicated**: `uniqueIds(formData.getAll('employee_ids'))`
    (`appointments.ts:314`, helper at `:96-98`). The reconcile may rely on this and must not
    re-implement it.

---

## 3. Decisions carried in from the #10 milestone (do not relitigate)

- **D-01** — read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` and
  `.../03-api-reference/04-functions/revalidatePath.md` before editing a server action.
- **D-22** — the Supabase clients are **untyped** (`SupabaseClient<any>`). `src/types/database.ts`
  is documentation and hand-maintained truth, not a compiler safety net. A wrong column name is a
  runtime PostgREST `400 / 42703`, never a `tsc` error. **`npx tsc --noEmit` passing proves nothing
  about this phase.**
- **D-32** — the local Supabase database is a shared mutable resource. Coders run **static gates
  only**; every database check belongs to one serial `verifier` pass. Carried forward verbatim as
  D-41.
- **D-34** — the phase verdict is **PASS or BLOCKED**, with no third state. Carried forward.
- Constitution **§6** — nothing is committed, pushed, or turned into a PR by any task in this phase.

---

## 4. The three decisions, and why

### 4.1 — Restoring the prior status needs a persisted column (D-36)

**Decision: add `appointments.status_before_cancel text NULL`.** It is not derivable.

Nothing else in the row records that an appointment was completed. Clock times are not a proxy:
`completed` is an explicit admin status write (`appointment-form.tsx:320` → `appointments.ts:722`),
an appointment can be completed with no crew assigned at all, and a crew can clock out on an
appointment nobody ever marked completed (`employee_clock` has **no** status predicate — §2.6).
Deriving the status would be guessing, and guessing wrong restores the same silent loss the issue
reports, one layer deeper.

`in_progress` needs it as much as `completed` does. Even if cancelling a completed appointment were
impossible (it now is, §4.2), *in_progress → cancel → reopen* still lands on `scheduled` and still
throws away a distinction the admin made deliberately. The column covers both.

The column is nullable with no default beyond NULL and **no backfill**: every existing row,
including rows already sitting at `status = 'cancelled'`, keeps NULL, and NULL restores to
`'scheduled'` — exactly today's behaviour. That is what makes it additive under constitution §4 and
silent-loss-free under §7. Two CHECK constraints carry the invariant (see `05-01-PLAN.md`), one for
the value domain and one for the coherence rule *the marker is non-null only while the row is
cancelled*.

**The domain CHECK deliberately permits `'completed'`** even though REQ-024 makes that value
unreachable through the application. The schema is not the place to encode an application policy
that a later product decision may reverse; if cancelling a completed appointment is ever allowed,
the code changes and the schema does not. The migration header says so in those words so a reviewer
does not read the gap as an oversight.

### 4.2 — `cancelAppointment` hard-refuses a completed appointment (D-37)

**Decision: refuse. `cancelAppointment` filters `.not('status','eq','completed')` and returns an
explicit error; the detail page does not render the Cancel control when the status is `completed`.**

Reasoning, in order of weight:

1. **`completed` is already terminal in this product**, at two layers (§2.10). A cancel path that
   silently overrides it contradicts a guard living 250 lines away in the same file. One rule about
   what `completed` means beats two.
2. **The complaint in the issue is silence, and record-and-restore is a silent state machine.**
   Under record-and-restore the admin sees `CANCELLED`, the system privately remembers `completed`,
   and the only way to discover which appointments are secretly completed is to read the column.
   Refusal is visible at the moment of the mistake and needs no memory to explain itself.
3. **Refusal is the option that invents no invoice semantics.** A completed appointment is the one
   most likely to be invoiced, and this application has no notion of a cancelled-but-billed visit:
   nothing recomputes an issued invoice, and the appointment's `billed_price_cents` cache and its
   live `invoice_appointments` row would both stand. Allowing the transition would open that
   question; refusing does not. (It does not *close* it either — §8 records the pre-existing gap
   that a **scheduled** invoiced appointment can still be cancelled. That is a separate issue and
   this phase does not touch it.)

**UI consequence, decided here so no one improvises it: hide the control, do not disable it and do
not surface an error.** The detail page's server-action wrappers discard the action's result
(§2.11), so an error return would be invisible and the button would look broken. The status badge
already reads `COMPLETED` two inches away, so hiding the control is self-explaining. The server
guard stays regardless — it is what protects against a stale page or a replayed submission, and its
job is to prevent the write, not to narrate it. **Converting that page to a Client Component with
`useActionState` to display the error is explicitly out of scope** (`05-02-PLAN.md` T2).

### 4.3 — Cancelled appointments are blocked from editing, *and* the reconcile lands regardless (D-38, D-39)

**Two decisions, and they are independent.**

**D-38 — block editing a cancelled appointment**, at both layers, in the same shape as the existing
`completed` guard. Reasons: the reopen path is now lossless (D-36), so *Reopen → edit → cancel
again* costs one click and loses nothing; every status transition then flows through exactly one
door per direction, which is what keeps the `status_before_cancel` invariant maintainable — if
cancelled rows stayed editable, the form's status `<select>` would be a second exit from
`cancelled` and the marker would need clearing on a third path; and it mirrors an idiom already in
the codebase rather than inventing one.

**D-39 — the `appointment_employees` delete-and-reinsert is replaced by a reconcile no matter what
D-38 says, because it is a live data-loss bug independent of cancellation.** Today, an employee
clocks in, the admin fixes the end time, and the clock times are gone — on an ordinary
`scheduled` appointment. Blocking cancelled edits does nothing for that. This is the highest-value
change in the phase and it is the one that must not be traded away if anything gets cut.

**Reconcile semantics — specified, not left to judgement:**

| Row | Action |
|---|---|
| existing row whose `employee_id` **is** in the submitted set | **untouched — no UPDATE at all.** Its `id`, `clocked_in_at`, `clocked_out_at`, `admin_notes`, `is_archived`, `created_at` all survive verbatim. |
| existing row whose `employee_id` is **not** in the submitted set | deleted, by `id` |
| submitted `employee_id` with **no** existing row | inserted, `admin_notes: ''`, as today |

- **Read every row for the appointment, with no `is_archived` filter** — matching what the current
  delete does. Filtering would leave an archived row behind for a removed employee and would treat
  an employee who already has an archived row as "new", inserting a duplicate.
- **Duplicate rows for one employee are all kept if that employee survives, and all deleted if they
  do not.** There is no unique constraint (§2.7), so duplicates can exist; de-duplicating them here
  would be a silent delete of clock data, which is the bug, not the fix.
- An empty submitted set deletes every row — unchanged from today, and an explicit admin action.
- The `admin_notes: ''` reset disappears by construction: surviving rows are never written.

**No pure helper is extracted and no unit test is added.** Constitution §13 (no premature
abstraction — there is no second caller) and §15 (the testing bar is *money and resolution*
functions), and a hard constraint besides: `appointments.ts` carries the `'use server'` directive,
so every export must be an async function. A pure exported `reconcile()` in that file is a build
error, and a new module for one caller is the abstraction §13 forbids. **Compute both sets inline.**

---

## 5. What this phase does not change

Listed because each is something a well-meaning agent would plausibly "fix while in there".

- **The edit form's status `<select>`** keeps all four options. Choosing *Completed* still makes the
  appointment permanently uneditable and now also uncancellable — that is today's behaviour for
  `completed` and this phase does not widen or narrow it.
- **`appointments_employee_view`** is not touched. It lists columns explicitly (§2.12), so
  `status_before_cancel` is invisible to employees by default, which is correct and needs no work.
- **`supabase/checks/pricing_backfill_check.sql`** gains nothing. The coherence CHECK makes the only
  invariant worth asserting unrepresentable in data, and constitution §14 forbids guarding a state
  a CHECK already makes impossible.
- **`employee_clock`**'s missing appointment-status predicate. An employee can still clock in on a
  cancelled appointment. Real, pre-existing, out of scope — §8.
- **The `future` edit scope's wholesale delete of future `scheduled` occurrences**
  (`appointments.ts:872-881`). It destroys any clock data on those occurrences. Real, pre-existing,
  a *different* bug from the one in issue #15 — §8.
- **The detail page's server-action wrappers** stay `'use server'` functions that discard results.
  **Consequence, recorded 2026-09-22 as KL-03 in `REQUIREMENTS.md`:** every error string this phase
  adds on the Cancel / Reopen paths — the two double-submit refusals and both "changed while you
  were cancelling/reopening it" races — is therefore **invisible**; the admin sees a click that does
  nothing. The write is still correctly refused. Accepted, not fixed. The edit page is unaffected:
  `appointment-form.tsx` renders `state.error` (`:85`, `:153-159`), so `updateAppointment`'s
  refusals, including REQ-028's, are displayed.
- **Any commit, push, PR, `supabase db push` or `supabase link`.**

---

## 6. Findings for the user — out of scope, candidates for their own issues

None of these blocks this phase. They were found while establishing §2 and are recorded so they are
not lost a second time.

1. **A `scheduled` or `in_progress` appointment can be invoiced and then cancelled, and stays
   billed.** The builders filter on `is_archived` only, never on status (§2.13). After this phase,
   `completed` appointments cannot be cancelled, but the invoiced-and-cancelled state is still
   reachable through the cheaper statuses. Deciding what a cancellation should do to a live invoice
   line is a product question the size of Phase 4.
2. **An employee can clock in and out on a cancelled appointment.** `employee_clock` authorises on
   assignment ownership alone (§2.6). Whether cancelled appointments should even appear on the
   employee schedule is a product question.
3. **`updateAppointment`'s `future` scope deletes future `scheduled` occurrences outright**
   (`:872-881`), taking their assignment rows and any clock data with them. Same class of loss as
   the bug in issue #15, different code path, not named in the issue.
4. **`appointment_employees` still has no unique constraint on `(appointment_id, employee_id)`.**
   Known since Phase 1. The reconcile in §4.3 is written to be correct with or without it, so this
   phase does not need it — but the duplicate-row handling would get simpler and safer if it existed.
5. **`updateAppointment` is not transactional across its statements.** *(added 2026-09-22, found by
   the post-implementation `/code-review high`.)* The action writes the appointment row, then
   reconciles `appointment_employees`, then — for the `future` scope — regenerates occurrences, in
   separate round trips with no transaction and no compensating rollback. If the reconcile or the
   regeneration fails after the appointment `.update()` has succeeded, **the status and field
   changes stand while the crew change does not**, and the admin is shown an error for an edit that
   partly landed. Pre-existing, unchanged by this phase — REQ-028's compare-and-set narrows *which*
   row the first write may hit, not how many writes there are. Same shape as D-30's accepted
   non-atomicity in `voidInvoice`, and the same remedy if it is ever wanted: one `SECURITY DEFINER`
   function, which constitution §12 and §13 argue against until a second caller exists.

---

## 7. Open questions

Both have applied defaults. **Neither blocks dispatch.** Each changes at most one task.

### OQ-C1 — architecture — *hard-refuse or record-and-restore for cancelling a completed appointment?*

Answered by the planner as **hard-refuse** (D-37, reasoning in §4.2). It is recorded as an open
question rather than a settled decision because it is the one genuinely product-shaped call in this
phase and the issue itself offers both ("skip already-completed appointments, **or** require
confirmation").

**If the user prefers record-and-restore instead**: `05-01-T1` is unaffected — the column already
permits `'completed'` by design (§4.1). What changes is `05-02-T1`'s guard (the `.not(...)` filter
becomes a marker write) and `05-02-T2`'s Cancel control (rendered for `completed` again, and the
detail page needs a visible "previously completed" affordance so the state is not secret). That is
a one-block rework of two tasks, not a replan.

### OQ-C3 — product — *a mistakenly-completed appointment now has no escape hatch* — **new 2026-09-22, opened after implementation; the user owns this one**

Raised by the post-implementation code review and recorded here for findability; the canonical entry
is in `STATE.md` → *Open questions — PHASE 5*. D-37 plus the hidden Cancel control means an admin who
picks *Completed* by mistake can no longer edit the appointment, cannot cancel it, and cannot reopen
it. Before this phase, *Cancel → Reopen* was the escape hatch (it reset the row to `scheduled`); this
work closes it without adding a replacement, and a wrongly-completed appointment stays billable on
the next invoice. **No fix is designed and no guard is changed until the user rules** — the options
and their costs are set out in `STATE.md`.

### OQ-C2 — detail — *should the Reopen button say what it will restore to?*

**Default: no.** Reopen stays a plain button. The restored status is visible on the badge one
second later, and a label that reads "Reopen as In Progress" needs the marker plumbed into the page
query and a fallback string for legacy NULL rows — new surface for no decision the admin has to
make. Affects `05-02-T2` only, and only additively.

---

## 8. How this phase is proven

**Half A — SQL, one serial `verifier` pass** (D-41, inherited from D-32). Schema shape from
`information_schema`, both CHECK constraints proven in *both* directions on real rows, the
no-backfill count, and the DOWN path executed. Detail in `05-01-PLAN.md` §Verification.

**Half B — browser, run by the user.** Every behavioural requirement in this phase lives in a
server action, which cannot be invoked from SQL and is not reachable by URL. The 12-step script in
`05-02-PLAN.md` §Verification is therefore the **binding** evidence for REQ-024, REQ-025, REQ-026
and REQ-027; the SQL half proves only that the statements those actions issue are valid against the
schema. No agent runs a browser pass in this project.

**Deploy order (D-40, constitution §5 — nothing enforces this but writing it down): the migration
ships FIRST or in the SAME release as the application code, never the code alone.** Migration-first
is safe: the column exists, nothing writes it, and behaviour is identical to today until the code
lands. Code-first is actively worse than the bug — `cancelAppointment` would send
`status_before_cancel` to a database without that column, PostgREST would answer `400 / 42703`, and
the detail page discards the result (§2.11), so **Cancel would silently do nothing at all**.

---

## 9. Standing instruction for every task in this phase

1. Read this file and `.planning/CONSTITUTION.md` first.
2. Read the vendored Next docs named in D-01 before editing a server action.
3. Match each file's existing indentation (constitution §12) — `appointments.ts` and both page files
   are 2-space.
4. **No commit, no push, no PR, no `supabase db push`, no `supabase link`.** Leave the tree dirty.
5. **Do not start, reset, seed or query a database.** Static gates only: your diff, `grep`,
   `npm run lint`, `npx tsc --noEmit`, and `npm run build` where the plan asks for it. The database
   belongs to the one verifier pass.
6. Touch only the files your task's **Files owned** block names.
