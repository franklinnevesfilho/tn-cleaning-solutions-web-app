-- A voided invoice stops consuming its appointments.
--
-- "invoice_appointments_appointment_id_key" UNIQUE ("appointment_id")
-- (20260427000000_schema_snapshot.sql:351-352) is global and status-blind: once any invoice line
-- exists for an appointment, no second line may ever exist for it, whatever became of the invoice
-- that holds the first. Voiding is terminal, so a visit that was invoiced, disputed and voided can
-- never be billed again even though nothing was collected. Both invoice builders read the junction
-- table with no status filter and exclude every appointment that appears in it at all
-- (invoices/new/page.tsx:70; invoices/[id]/edit/page.tsx:84), so the visit also disappears from the
-- UI that would otherwise let an admin try. This replaces that table-wide constraint with a unique
-- index over the live junction rows only.
--
-- WHY THE PREDICATE IS "is_archived" AND NOT INVOICE STATUS. Issue #18 asks for uniqueness "scoped
-- to non-void invoices". That phrasing cannot be implemented literally: a partial index predicate
-- may only reference columns of the table it indexes, it cannot join to "invoices" to read
-- "status", and "invoice_appointments" has no status column of its own -- Postgres rejects a
-- subquery in an index predicate outright. The issue's intent is delivered through the release
-- marker instead: "is_archived" is set by voidInvoice, void is the only event in this system that
-- releases an appointment, and so "no live junction row" and "no junction row on a non-void
-- invoice" describe the same set of rows for everything this application can create. Only the
-- "is_archived" form is expressible in SQL. This is how #18 is delivered, not a change to what it
-- asks for.
--
-- BACKFILL: none. No row is inserted, updated or deleted by this migration, and no column is
-- added, dropped or retyped. Only the uniqueness rule changes. (See LEGACY ROWS below: invoices
-- voided before this migration ran are deliberately left alone, and releasing them needs a
-- human-approved constitution exception that does not exist.)
--
-- CONSTITUTION §4. Dropping "invoice_appointments_appointment_id_key" is a widening, not a
-- destructive change. Every row the old constraint permitted is still permitted by the new index;
-- the permitted set strictly grows, because an appointment may now hold one live claim plus any
-- number of released records. No column is added, dropped or retyped, no row is touched, and no
-- stored value becomes unreachable -- the historical lines a released row carries
-- (billed_amount_cents, billed_rate_cents, billed_minutes) are still there and still render on the
-- invoice that froze them. §4's additive-or-widening bar is therefore met and NO ARCH-1-STYLE
-- HUMAN-APPROVED EXCEPTION IS REQUIRED. The approving requirement is REQ-022(b).
--
-- The CREATE below cannot fail on existing data: the dropped constraint made every
-- "appointment_id" in the table distinct, so they are still distinct inside any subset of the
-- table, including the is_archived = false subset. "is_archived" is NOT NULL DEFAULT false
-- (20260918120000:142-145) and "appointment_id" is NOT NULL, so the predicate partitions the table
-- cleanly and no row lands outside both halves -- a nullable flag would leave rows in neither half
-- and silently exempt them from uniqueness.
--
-- Nothing references the dropped constraint by name: no foreign key targets it and no ON CONFLICT
-- clause exists anywhere in the app. createInvoice's duplicate handling matches on the error
-- message rather than the constraint name (isUniqueConstraintError, src/lib/actions/invoices.ts:
-- 289-292, which tests for "duplicate key" or "unique"), and a partial-index violation still reads
-- 'duplicate key value violates unique constraint "..."', so that path is unchanged.
--
-- The index is built before the constraint is dropped, so a failure at any point leaves the old
-- rule in force. Not CONCURRENTLY: the CLI runs each migration file inside a transaction and
-- CREATE INDEX CONCURRENTLY aborts with 25001 there, and splitting the build out of the
-- transaction would open a window in which neither rule protects the table.
--
-- DOWN (executed 2026-09-21 against a freshly reset local database: both statements succeeded and
-- the old constraint returned while the partial index went away). Reverses the schema exactly.
--
--   DROP INDEX "public"."invoice_appointments_live_appointment_id_idx";
--
--   ALTER TABLE ONLY "public"."invoice_appointments"
--       ADD CONSTRAINT "invoice_appointments_appointment_id_key" UNIQUE ("appointment_id");
--
-- That ADD is the one part of the down path that can fail on data, and only on a database that
-- used the behaviour this migration enables: an appointment holding an archived row and a live row
-- satisfies the index but violates the re-added constraint. Find them with the query below and
-- delete or re-point the archived side before running the down path. Do not weaken the re-added
-- constraint to accommodate them.
--
--   SELECT "appointment_id", count(*)
--     FROM "public"."invoice_appointments"
--    GROUP BY "appointment_id"
--   HAVING count(*) > 1;
--
-- LEGACY ROWS -- NOT EXECUTED, AND NOT TO BE UNCOMMENTED WITHOUT A HUMAN-APPROVED CONSTITUTION
-- EXCEPTION NAMED AND DATED LIKE ARCH-1. This migration is forward-only. Invoices voided before it
-- ran still hold junction rows with is_archived = false and appointments whose billed_price_cents
-- is populated, so those visits stay unbillable -- the exact complaint in issue #18, for the exact
-- rows that provoked it. The objection is authority, not mechanism: voidInvoice clears that same
-- column at runtime under REQ-022(d), which the user approved, but a backfill is an unrequested,
-- unattended write across every historical row of a live database at deploy time with no admin in
-- the loop. Constitution §7's standing instruction for that case is to report the discrepancy and
-- stop, so this migration reports and stops. Size the blast radius first:
--
--   SELECT count(*) FROM public.invoice_appointments ia
--     JOIN public.invoices i ON (i.id = ia.invoice_id)
--    WHERE i.status = 'void' AND ia.is_archived = false;
--
-- The remediation, if and only if it is ever authorised, is these two statements in this order and
-- no other -- release first, then clear the caches the release orphaned:
--
--   UPDATE public.invoice_appointments ia SET is_archived = true
--     FROM public.invoices i
--    WHERE i.id = ia.invoice_id AND i.status = 'void' AND ia.is_archived = false;
--
--   UPDATE public.appointments a SET billed_price_cents = NULL
--    WHERE a.billed_price_cents IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM public.invoice_appointments ia
--                       WHERE ia.appointment_id = a.id AND ia.is_archived = false);
--
-- The second must be scoped by NOT EXISTS (... is_archived = false) and never by invoice status,
-- because that NOT EXISTS is precisely the iff pricing_backfill_check.sql asserts: a cache value
-- exists exactly when a live junction row claims the appointment, and then it equals that row's
-- billed_amount_cents. Scoping by status instead breaks the iff in both directions -- it clears the
-- cache of an appointment whose void invoice released it but which a second, non-void invoice has
-- since claimed, and it leaves a cache standing on an appointment whose only claim was released by
-- some path other than a void. Only the live-claim scoping clears exactly the caches that nothing
-- backs.


-- Named for what it covers rather than for the constraint it replaces: "live" is the
-- is_archived = false predicate and the "_idx" suffix says this is a bare index, so nobody reaches
-- for DROP CONSTRAINT on it. The column list matches the old constraint name so that a search for
-- the old name's shape still finds the rule that took its place.
CREATE UNIQUE INDEX "invoice_appointments_live_appointment_id_idx"
    ON "public"."invoice_appointments" ("appointment_id")
 WHERE ("is_archived" = false);


ALTER TABLE "public"."invoice_appointments"
    DROP CONSTRAINT "invoice_appointments_appointment_id_key";


COMMENT ON INDEX "public"."invoice_appointments_live_appointment_id_idx" IS 'An appointment may be claimed by at most one live invoice line at a time; the composite primary key still forbids two lines for it on the same invoice. Released rows (is_archived = true) are excluded on purpose: a voided invoice must not consume the visit forever, which is the whole of issue #18.';


COMMENT ON COLUMN "public"."invoice_appointments"."is_archived" IS 'The release marker. true means the invoice that held this line was voided and the appointment has been returned to the billable pool, so this row claims nothing and invoice_appointments_live_appointment_id_idx ignores it. The row itself is retained in full -- billed_amount_cents, billed_rate_cents and billed_minutes are never cleared -- so the voided invoice still renders its original lines and total (constitution §7). Written only by voidInvoice; archiveInvoice and restoreInvoice never touch it.';
