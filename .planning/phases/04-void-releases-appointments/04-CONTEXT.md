# 04-CONTEXT — Voiding an invoice releases its appointments

Phase 4. Delivers **REQ-022** in full, and amends **REQ-002** and **REQ-018** where REQ-022's
landing changes what they assert. Opened 2026-09-21 after the user scheduled GitHub issue #18.

This phase exists because the user filed and then scheduled the defect that `02-03` deliberately
left alone. Nothing here is new analysis: REQ-022's four parts (a)–(d) and `STATE.md` D-23, D-24,
D-25 are the approved mechanism and this document only sharpens them into something an agent can
execute cold.

---

## 1. What is being fixed, in one paragraph

Voiding an invoice is terminal, and `invoice_appointments_appointment_id_key UNIQUE (appointment_id)`
(`supabase/migrations/20260427000000_schema_snapshot.sql:352`) is global and status-blind. Both
invoice builders exclude any appointment holding *any* junction row, with no status filter
(`invoices/new/page.tsx:70,88-90`; `invoices/[id]/edit/page.tsx:84,117-121`). So a visit that was
invoiced, disputed and voided can never be billed again through the UI, even though nothing was
collected. This phase replaces the table-wide UNIQUE with a partial unique index over **live**
junction rows, makes `voidInvoice` mark its own junction rows as released, teaches both builders to
ignore released rows, and narrows the check script's two cache invariants to match.

**It is all-or-nothing** (REQ-022). Any proper subset makes the product worse than leaving it alone.
The phase gate below enforces that: no task in this phase is PASS on its own.

---

## 2. The one wording tension in issue #18, resolved

Issue #18 says *"scope the unique constraint on `invoice_appointments.appointment_id` to non-void
invoices (partial unique index)"*. **That phrasing cannot be implemented literally and must not be
attempted.** A partial index predicate may only reference columns of the table it indexes; it
cannot join to `invoices` to read `status`, and `invoice_appointments` has no status column of its
own. Postgres rejects a subquery in an index predicate (`ERROR: functions in index predicate must
be marked IMMUTABLE` / `cannot use subquery in index predicate`).

**REQ-022(b) is the technically correct reading and is confirmed.** The predicate keys on
`invoice_appointments.is_archived`, the release marker REQ-022(a) introduces:

```sql
CREATE UNIQUE INDEX ... ON invoice_appointments (appointment_id) WHERE is_archived = false;
```

The issue's intent — *"an appointment on a voided invoice can be re-invoiced"* — is satisfied
**because `voidInvoice` is the thing that sets the marker.** Void is the only event in the system
that releases; the index enforces the consequence. The two statements are equivalent in behaviour
for every row this application can create, and only the `is_archived` form is expressible in SQL.
This is a clarification of how #18 is delivered, **not** a change to the agreed mechanism.

The column is already the right shape for it: `is_archived boolean DEFAULT false NOT NULL`
(`supabase/migrations/20260918120000_hourly_pricing_and_client_job_pricing.sql:142-145`). NOT NULL
matters — a nullable flag would leave rows outside both halves of the predicate and silently exempt
them from uniqueness. It is currently written and read by nothing.

---

## 3. Decisions carried in from the #10 milestone (do not relitigate)

| Ref | What it settles |
|---|---|
| **D-23** | Before REQ-022, `voidInvoice` must **not** clear `appointments.billed_price_cents` — the stale chip is honest, because the visit really is unbillable. **REQ-022 is exactly the condition that reverses this**, and `04-02-T1` implements the reversal. D-23 is not being overturned; its premise is being removed. |
| **D-24** | `archiveInvoice` / `restoreInvoice` leave `billed_price_cents` alone, **and keep doing so after REQ-022 lands**. Archival is a visibility flag; an archived *paid* invoice is money that really was billed. Clearing it there would misstate history (constitution §7). This is REQ-022(d)'s second sentence and is a hard boundary on `04-02-T1`. |
| **D-25** | The check script's two cache invariants are a single **iff** and must be narrowed together or not at all. Narrowing only the first makes a stale cache invisible to both. `04-01-T2` narrows both, in one task, or neither. |
| **OQ-R1** | Ratified as (a) on 2026-09-21; `02-03` reverted the half-fix. The tree is at the clean pre-REQ-022 baseline, so `04-02-T1` starts from `voidInvoice` writing only the status (`src/lib/actions/invoices.ts:597-634`). |

---

## 4. Facts established by reading the tree at `926f088`

Every implementer should take these as given rather than re-deriving them.

- `invoice_appointments` columns today: `invoice_id`, `appointment_id`, `billed_amount_cents`
  (NOT NULL), `billed_rate_cents`, `billed_minutes`, `created_at`, `updated_at`,
  `is_archived boolean NOT NULL DEFAULT false`. PK `(invoice_id, appointment_id)`; a second UNIQUE
  on `(appointment_id)` alone; FK to both parents `ON DELETE CASCADE`; a `set_updated_at` BEFORE
  UPDATE trigger.
- **`04-02-T1` will be the first code path in this application that ever runs an `UPDATE` against
  `invoice_appointments`.** Every existing write path deletes and re-inserts. That trigger raised
  `record "new" has no field "updated_at"` on every UPDATE until `20260918120000` added the column
  (see its section 3 commentary). The column exists now, so the UPDATE works — but this is the
  first time it is exercised from the app, and the verification below proves it rather than
  assuming it.
- `src/types/database.ts` already carries `is_archived` on `invoice_appointments` (`:487`, `:497`,
  `:507`). The **only** hand edit constitution §9 requires in this phase is the relationship flag:
  `invoice_appointments_appointment_id_fkey` is declared `isOneToOne: true` (`:513`) because of the
  UNIQUE being dropped. It becomes `false`.
- **No query in the repo embeds `appointments → invoice_appointments`.** The only embed of the
  junction table is `invoices → invoice_appointments` in
  `src/app/(internal)/solutions/(admin)/invoices/[id]/page.tsx:140`, which is to-many and
  unaffected by dropping the UNIQUE. So the PostgREST shape change costs nothing at runtime, and
  the `isOneToOne` flip is a types-only correction.
- `createInvoice`'s duplicate handling (`invoices.ts:352-361`) maps any error whose message
  contains `duplicate key` or `unique` (`isUniqueConstraintError`, `:289-292`) to
  `duplicateAppointmentError`. A partial-index violation reads
  `duplicate key value violates unique constraint "…_idx"`, so that mapping keeps working
  unchanged. Nothing in the app names the dropped constraint by name; no `ON CONFLICT` clause
  exists anywhere.
- `clearBilledPriceCache` (`invoices.ts:262-273`) already exists, takes `string[]`, and has one
  live caller (`updateInvoice:476`). `04-02-T1` gives it a second. It logs and swallows errors, as
  does `writeBilledPriceCache` — that is the file's convention and is not changed here.
- The "Invoiced" chip is driven entirely by `appointments.billed_price_cents`
  (`appointments/page.tsx:128-129` → `appointments-list.tsx:125-129`;
  `appointments/[id]/page.tsx:146-155`). Clearing the cache is therefore the whole of what the
  admin sees change.
- Nothing aggregates `appointments.billed_price_cents`. Every revenue figure reads
  `invoices.total_cents` (`invoices/page.tsx:114,165`, `dashboard/page.tsx:84,282`), which this
  phase never touches. **No money figure anywhere moves as a result of this phase.**
- `supabase/seed.sql`, `supabase/test-data.sql` and `scripts/seed-admin-users.ts` create **no
  invoices and no junction rows**. There is no seeded fixture to void. This shapes the whole
  verification section below.
- `supabase/migrations/20260921120000_client_job_pricing_partial_unique.sql` is the in-repo
  precedent for exactly this migration shape: build the partial index first, drop the constraint
  second, DOWN SQL in the header with the data hazard named and a query to find it. Match its
  header conventions and its `_live_` naming.

---

## 5. Amendments this phase makes to already-approved text

Each is a change to something the user approved. They are listed here, applied in
`REQUIREMENTS.md`, and surfaced in the planner's report.

**AMD-3 — REQ-002's two cache invariants key on `is_archived`, not on invoice status.**
REQ-022's acceptance says the invariants follow REQ-002 **Branch B**, "additionally excluding
released (`is_archived = true`) junction rows … not only void ones". Read literally that is two
predicates: *not released* **and** *not on a void invoice*. **The status predicate is dropped and
only the `is_archived` predicate is kept.** Reasoning:

- With release as the marker, the two predicates are equivalent for every row this application can
  produce going forward — `voidInvoice` is the only writer of `is_archived`, and it writes it on
  exactly the rows whose invoice it just voided.
- They are **not** equivalent for invoices voided before this migration. Those rows have
  `is_archived = false` and a populated, matching cache. Under `is_archived` alone they are
  consistent and both invariants read 0. Under a status predicate the first invariant skips them on
  status while the second finds no "live" row and counts them — a false "MUST BE 0" alarm on data
  that is not broken.
- So the `is_archived`-only wording is correct **whichever way OQ-V1 is answered**, and the
  two-predicate wording is correct only under one of them. The narrower assertion is also the
  honest one: what the system now means by "spoken for" is the release marker.

**AMD-3b — the two invariant labels gain the word "live".** REQ-002 Branch B says the labels are
unchanged under either branch. They change, to
`appointment cache disagrees with its live junction row` and
`appointment cached a price with no live junction row`. A label that still says "its junction row"
after the predicate has been narrowed would assert something the query no longer checks, and this
file is read by a human looking for a number that must be 0.

**AMD-4 — REQ-018's closing sentence is superseded.** REQ-018 currently ends *"Until REQ-022 lands,
`voidInvoice` writes `billed_price_cents` never"*, and its acceptance bullet reads *"Issuing,
voiding, archiving or restoring the invoice leaves `billed_price_cents` untouched."* REQ-022 is now
landing, so that bullet is split: **issuing, archiving and restoring** still leave it untouched
(D-24, unchanged and still enforced); **voiding** now clears it, for exactly the appointments it
releases, per REQ-022(d). The original text is preserved in place beneath the amendment.

---

## 6. Open questions

### OQ-V1 — architecture — *does the migration release appointments consumed by invoices that were voided before it ran?*

**The question.** Every invoice already voided on the live database (`blhxzilsjuzbeoxtkbap`) holds
junction rows with `is_archived = false` and appointments whose `billed_price_cents` is populated.
Nothing in this phase's forward path touches them, so **those visits stay permanently unbillable
even after the fix ships** — which is the exact complaint in issue #18, for the exact rows that
provoked it.

**Recommended default: forward-only. Do not backfill in the migration.**

**Be precise about why, because the obvious phrasing is self-contradictory.** It is *not* that
clearing `appointments.billed_price_cents` is inherently a §7 violation — `voidInvoice` clears
exactly that column at runtime, and that is REQ-022(d), which the user approved. The column's own
comment (`20260918120000:204`) calls it a display cache, and the amount it caches survives
untouched on `invoice_appointments.billed_amount_cents` either way. Clearing it is not destroying
history.

The real distinction is **authority, not mechanism**:

- **REQ-022(d) is approved work with a named trigger.** The user scheduled issue #18; the clear
  happens on a specific admin action, for the rows that action just released, and is visible and
  reversible in the ordinary sense that the admin caused it.
- **A migration backfill is an unrequested, unattended write across every historical row**, on a
  live database the planner has never seen (AS-09, AS-13). Nobody has approved it, nobody knows how
  many rows it touches, and it runs at deploy time with no admin in the loop. Constitution §7's
  standing instruction for exactly that case is *"report the discrepancy and stop"*, and §4 requires
  every migration to state its backfill. A backfill nobody asked for is the thing both clauses
  exist to stop — which is why the ARCH-1 carve-out had to be named, dated and human-approved
  rather than argued for from first principles.

So the migration **reports and stops**: `04-01-T1` ships the remediation as a commented,
ready-to-run block in the migration header together with the query that sizes the blast radius, and
runs neither. What is being asked of the user is authorisation, not a technical judgement.

**If the user answers "backfill":** `04-01-T1` uncomments the two statements (release first, then
clear the cache for appointments left with no live junction row — the order matters and the second
must be scoped by `NOT EXISTS (… WHERE is_archived = false)`, never by invoice status), the
migration header states the backfill per §4, and **the constitution gains a named exception dated
today**, which only the user can authorise. Nothing else in the phase changes: `04-01-T2`,
`04-02-T1` and `04-02-T2` are unaffected either way, by design (see AMD-3).

**Blocks:** only `04-01-T1`, and only its commented block. The task is dispatchable now against the
default. Reversing it later is two UPDATE statements, not a replan.

### OQ-V2 — architecture, low stakes — *does voiding need to be atomic?*

`voidInvoice` will perform three writes across three round trips: status → release → cache clear.
There is no transaction; `@supabase/supabase-js` has none, and this codebase has never used an RPC
for a multi-write action (`createInvoice` already has a non-atomic invoice-then-links path with a
hand-rolled restore, `invoices.ts:340-368`).

**Recommended default: no RPC. Keep the three round trips, in the order status → release → clear.**
The ordering is the safety argument, and it is the opposite of what REQ-022(d) reads at first
glance:

- **Void first.** If the release write then fails, the invoice is void and its appointments are
  still consumed — which is precisely today's behaviour, a known state the product has always had,
  and the admin gets an error saying so.
- **Release first would be worse.** If the status write then failed, the invoice would still be
  draft/issued while its junction rows were released — the appointment becomes claimable by a
  second invoice while the first still displays and totals it. That is a double-billing window, a
  new failure mode this phase would have introduced.

REQ-022(d) says the cache clear happens "after the status write and the release write both
succeed", which this ordering satisfies exactly. The alternative — a `SECURITY DEFINER` function
doing all three in one transaction — is rejected under constitution §12 (existing conventions win)
and §13 (no premature abstraction), and is recorded here so it is not re-proposed as a finding.

### Detail questions — defaults applied, execution proceeds

| # | Question | Default |
|---|---|---|
| **DET-V1** | The edit builder's *per-invoice* read (`invoices/[id]/edit/page.tsx:81`) also selects junction rows — filter it on `is_archived` too? | **No.** Only `draft` invoices reach that page (`:91`) and a draft's rows are never released, so the filter would guard a state the workflow cannot produce (constitution §14). The *cross-invoice* read at `:84` is the one that must be filtered. This is in `04-02-T2`'s out-of-scope list so a reviewer does not read the asymmetry as an oversight. |
| **DET-V2** | Index name. | `invoice_appointments_live_appointment_id_idx` — mirrors `client_job_pricing_live_client_id_job_id_effective_from_idx` from the precedent migration: `live` names the predicate, `_idx` says it is a bare index so nobody reaches for `DROP CONSTRAINT`. |
| **DET-V3** | Migration filename. | `supabase/migrations/20260921130000_void_releases_appointments.sql` — next slot after `20260921120000`. |
| **DET-V4** | Does `voidInvoice` need to check whether a released appointment still has another live claim before clearing its cache? | **No.** After the release write, the partial unique index guarantees at most one live junction row per appointment existed and it was this invoice's. An unconditional clear over the released ids is correct. |
| **DET-V5** | Does `voidInvoice` return an error, or succeed quietly, when the release write fails after the status write landed? | **Return `{ success: false }`** with a message naming the state: the invoice was voided but its appointments were not released. Still call `revalidateInvoicePaths(id)` first — the status really did change and the screens must not lie about it. A swallowed `clearBilledPriceCache` failure stays swallowed, matching `writeBilledPriceCache`. |
| **DET-V6** | Should the check script gain a new invariant asserting that a released junction row always belongs to a void invoice? | **No.** True today only because `voidInvoice` is the sole writer; it would fire on any future legitimate release path and it is not in REQ-022's acceptance. Out of scope for `04-01-T2`. |

---

## 7. How re-invoicing is proven end to end

Constitution §5 forbids touching the remote project; §16 demands row counts, never exit codes.
There is no seeded invoice anywhere in the repo, so the proof splits in two and **both halves are
required for the phase to PASS**.

### 7.0 The local database is a shared mutable resource. Only one pass may touch it.

File exclusivity makes the four tasks concurrent; **the single local Supabase instance does not.**
Every DB-state check in this phase mutates or depends on global database state:

- `04-01-T1`'s counts (`released rows after reset = 0`, `appointments with a cached price after
  reset = 0`) are only true on a **freshly reset** database, and its DOWN check needs a reset, a
  DOWN run and another reset.
- `04-01-T2`'s discriminating check needs **fixture rows** — an archived junction row over an
  appointment whose `billed_price_cents` is populated.
- `04-02-T1`'s acceptance needs a **real void** having written junction rows.

Run concurrently, any `db reset` erases another task's fixtures and any fixture falsifies the
"want 0 after reset" counts. The results become order-dependent, which is another way of saying
they are not evidence.

**The rule, and it is binding on every task in this phase:**

- **The four coding agents run static gates only.** `git diff` inspection, `grep`, `npm run lint`,
  `npx tsc --noEmit`, and `npm run build` for `04-02-T2`. **No coder runs `supabase start`,
  `supabase db reset`, `npx supabase db query`, `npm run seed:admin` or `test-data.sql`, and no
  coder is expected to produce a row count.** Each task's plan marks its DB-state criteria as
  *verifier-executed*; they are still that task's acceptance, they are simply not that task's to
  run.
- **One serial `verifier` pass, after all four tasks have landed,** owns the database and runs
  E1–E6 in order (`04-01-PLAN.md`). It is the only actor that resets, seeds, fixtures or queries.
- **The DOWN path (E6) is the verifier's**, not `04-01-T1`'s, for the same reason. `04-01-T1`
  therefore **writes its DOWN SQL header with the precedent's "NOT yet executed" wording**
  (`20260921120000_client_job_pricing_partial_unique.sql`), which is honest at the moment that task
  lands.
- **The verifier cannot edit files.** When E6 succeeds it reports the executed DOWN as evidence and
  **names the header line that must change**; the orchestrator dispatches that one-line header
  correction to `coder-jr` (or applies it), and it is the last edit of the phase. If E6 is not run —
  no Docker, no stack — the header stays as written and the deferral is reported, not papered over.

### 7.0b Deploy order, for the human who ships this (constitution §5)

Deployment is a human step outside this plan, and **the order is not free**. Ship the migration
**first, or in the same release as the application code** — never the application code alone.

- Migration first, code later: safe. The partial index is in force and nothing sets `is_archived`,
  so behaviour is identical to today until the code arrives.
- Code first, migration later: **this is precisely the half-fix REQ-022 forbids.** `voidInvoice`
  would mark rows released and clear their caches while the table-wide UNIQUE still stands, so the
  builders would offer the visit again and `createInvoice` would reject it with the generic
  "already attached to another invoice" error — a false affordance with no visible cause, which is
  worse than the bug being fixed.

This belongs in the phase summary the orchestrator hands the user, not only here.

### Half A — SQL, on a local stack, run by `verifier` (one serial pass; see §7.0)

This half proves the schema and the release semantics without a browser and without the app. It is
written in full in `04-01-PLAN.md`'s verification section. Shape:

1. `supabase start` → `supabase db reset` → `npm run seed:admin` → `test-data.sql`.
2. A catalogue check: the old constraint is gone (count 0), the partial index exists with the
   predicate `WHERE (is_archived = false)` (count 1).
3. A disposable fixture builds one invoice over one seeded appointment directly in SQL.
4. The **negative** test: a second *live* junction row for that appointment is rejected with
   SQLSTATE 23505.
5. The **positive** test: archive the first row, repeat the same insert — it now succeeds. That,
   and only that, is the proof that release genuinely returns the appointment to the billable pool.
6. `pricing_backfill_check.sql` section 3 reads 0 on a database that contains a released row.

> **CLI trap, carried forward from the check script's own header.** `npx supabase db query --file`
> sends the file as a **single prepared statement**; a file holding several `SELECT`s fails with
> *"cannot insert multiple commands into a prepared statement"*. Every proof above must therefore
> be one statement — a `UNION ALL` over labelled counts, or a single data-modifying CTE. Write
> them into the scratchpad, not into the repo.

**If Docker is unavailable and the local stack cannot start,** the SQL half cannot run. The
migration's DOWN header already carries the *"NOT yet executed"* wording (§7.0), so nothing needs
correcting; the verifier reports the deferral explicitly, the header-correction edit is not
dispatched, and Half A becomes the user's to run. It is not silently dropped.

### Half B — browser, run by the user

The user has run every browser pass in this project manually and has said they will continue. **No
agent starts `qa-visual` or a browser for this phase.** What is being asked of the user is one
pass, roughly ten minutes, against a local stack, signed in as the seeded admin. The full script is
in `04-02-PLAN.md`'s verification section; the shape is:

create an appointment → invoice it → issue it → confirm the frozen amount and the "Invoiced" chip →
**void** → confirm the visit now shows its live derived price with no chip → confirm it is offered
again in `/solutions/invoices/new` → invoice it a second time and confirm that succeeds → reopen
the **voided** invoice and confirm its line, its frozen amounts and its total are all unchanged and
still render → archive and restore the second invoice and confirm the chip and amount survive both
(D-24) → devtools network panel shows zero `/rest/v1/` responses ≥ 400 throughout.

Steps 6 through 9 of that list are the entire point of issue #18 and cannot be proven any other
way, because they exercise `voidInvoice` and both builder queries through a real admin session.

---

## 8. Phase gate

All four tasks landed, then, in one serial `verifier` pass (§7.0):

- `npm run lint` clean, `npx tsc --noEmit` clean, `npm run build` succeeds, `npm test` passes
  (constitution §16).
- Half A's SQL evidence, E1–E6, as row counts.
- Half B's browser pass, by the user.
- `pricing_backfill_check.sql` section 3 all 0, run **after** Half B has left a released row in the
  database — a run against a database with no void invoice proves nothing about the new predicate.
- The migration's DOWN header corrected if E6 ran (§7.0).
- Nothing committed (constitution §6).

**No task in this phase passes alone** (REQ-022, all-or-nothing). The gate is the unit.

**Verdict contract — the verifier returns PASS or BLOCKED, and nothing else.** There is no
"verified, phase not closed". Concretely:

- Everything above satisfied, including the user's browser pass reported back → **PASS**.
- Any of the four tasks missing, any E-check failing, or **the user's browser pass not yet reported
  back** → **BLOCKED**, with the reason named. Half B is a gate item, not a footnote: until its
  result is in hand the phase-level verdict is BLOCKED, and the orchestrator's next action is to
  relay the script to the user rather than to close the phase.

This is not pessimism about the code. It is that steps 7–10 of Half B are the only executed proof
of REQ-022's central acceptance bullets, and a phase closed without them would be closed on
inference.

---

## 9. Standing instruction for every task in this phase

Per the project's root `AGENTS.md`: this repository declares a non-standard Next.js. **Read the
relevant guide under `node_modules/next/dist/docs/` before writing any framework code** — for this
phase that means `01-app/01-getting-started/06-fetching-data.md` for the two builder pages and
`01-app/01-getting-started/07-mutating-data.md` plus
`01-app/03-api-reference/04-functions/revalidatePath.md` for the action. `CODEBASE-MAP.md` records
that the analyst found stock `next@16.2.4` docs there and treats the claim as unverified; read them
anyway, and heed any deprecation notice you find.
