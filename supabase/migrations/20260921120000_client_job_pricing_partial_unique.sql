-- Archived rates stop reserving their slot.
--
-- "client_job_pricing" is soft-deleted through "is_archived", but
-- "client_job_pricing_client_id_job_id_effective_from_key" counts archived rows. An admin who
-- archives a wrong rate and re-enters a corrected one for the same client, job and effective_from
-- is rejected against a row the pricing list no longer shows, and the only way out of the UI is to
-- restore the bad row and edit it. This replaces that table constraint with a unique index over
-- the live rows only, which is what the resolver has always meant: pickEffectiveRule and
-- fetchClientJobRules both discard archived rows before choosing a rate, so uniqueness among
-- archived rows never bought anything.
--
-- BACKFILL: none. No row is inserted, updated or deleted by this migration, and no column is
-- added, dropped or retyped. Only the uniqueness rule changes.
--
-- This is a relaxation, not a destructive change, so the CREATE below cannot fail on existing
-- data: the dropped constraint made every (client_id, job_id, effective_from) triple in the table
-- distinct, so those triples are still distinct inside any subset of the table, including the
-- is_archived = false subset. "is_archived" is NOT NULL DEFAULT false and the three key columns
-- are NOT NULL, so the predicate partitions the table cleanly and no row lands outside both
-- halves. Nothing references the dropped constraint: no foreign key targets this table, and no
-- ON CONFLICT clause in the app names it.
--
-- The index is built before the constraint is dropped, so a failure at any point leaves the old
-- constraint in force. Not CONCURRENTLY: the CLI runs each migration file inside a transaction and
-- CREATE INDEX CONCURRENTLY aborts with 25001 there, and splitting the build out of the
-- transaction would open a window in which neither rule protects the table. The table holds one
-- row per negotiated rate, so the brief ACCESS EXCLUSIVE lock costs nothing.
--
-- DOWN (NOT yet executed -- no database was started for this task; run it against a reset database
-- before deploying). Reverses the schema exactly.
--
--   DROP INDEX "public"."client_job_pricing_live_client_id_job_id_effective_from_idx";
--
--   ALTER TABLE ONLY "public"."client_job_pricing"
--       ADD CONSTRAINT "client_job_pricing_client_id_job_id_effective_from_key" UNIQUE ("client_id", "job_id", "effective_from");
--
-- That ADD is the one part of the down path that can fail on data, and only on a database that
-- used the behaviour this migration enables: an archived row and a live row sharing a
-- (client_id, job_id, effective_from) triple satisfy the index but violate the re-added
-- constraint. Find them with the query below and delete or re-date the archived side before
-- running the down path. Do not weaken the re-added constraint to accommodate them.
--
--   SELECT "client_id", "job_id", "effective_from", count(*)
--     FROM "public"."client_job_pricing"
--    GROUP BY 1, 2, 3
--   HAVING count(*) > 1;


-- Named for what it actually covers rather than for the constraint it replaces: "live" is the
-- is_archived = false predicate and the "_idx" suffix says this is a bare index, so nobody reaches
-- for DROP CONSTRAINT on it. The column list matches the old constraint name so that a search for
-- the old name's shape still finds the rule that took its place.
CREATE UNIQUE INDEX "client_job_pricing_live_client_id_job_id_effective_from_idx"
    ON "public"."client_job_pricing" ("client_id", "job_id", "effective_from")
 WHERE ("is_archived" = false);


ALTER TABLE "public"."client_job_pricing"
    DROP CONSTRAINT "client_job_pricing_client_id_job_id_effective_from_key";


COMMENT ON INDEX "public"."client_job_pricing_live_client_id_job_id_effective_from_idx" IS 'Two live rules for the same client, job and day would make "the newest applicable rule" ambiguous, so the resolver relies on this index to skip tie-breaking. Archived rows are excluded on purpose: a soft-deleted rate must not block re-entering a corrected one for the same date.';
