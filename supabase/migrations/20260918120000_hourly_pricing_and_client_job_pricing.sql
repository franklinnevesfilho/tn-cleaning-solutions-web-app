-- Hourly pricing foundation.
--
-- This migration turns the one flat per-visit price on "jobs" into an hourly rate, adds the
-- per-client negotiated rate table, and gives invoice lines a frozen amount of their own so an
-- invoice stops being recomputed from today's rates every time it is opened.
--
-- The rename on "jobs" is a deliberate business reinterpretation approved by the owner on
-- 2026-09-18: the stored number is carried across untouched and now means dollars per scheduled
-- hour instead of dollars per visit. A job at 12000 becomes $120.00/hour. Nothing here divides by
-- "estimated_duration_minutes" and nothing recalculates a rate -- a compensating conversion would
-- silently overwrite the owner's decision. Run supabase/checks/pricing_backfill_check.sql to see
-- what the reinterpretation does to every job and every un-invoiced appointment before deploying.
--
-- Historical money does not move. The junction backfill below reproduces
-- "price_override_cents ?? base_price_cents ?? 0" -- the exact expression the app charged with
-- before this migration -- so every already-invoiced amount is bit-for-bit what it was.
--
-- DOWN (verified: executed once against a reset database on 2026-09-18, then the database was
-- reset again). Reverses the schema exactly. It cannot un-bump the "updated_at" values the two
-- backfill UPDATEs below stamp on "appointments" and "invoice_appointments", and it does not need
-- to: no screen reads either column.
--
--   ALTER TABLE "public"."appointments" DROP COLUMN "billed_price_cents";
--
--   ALTER TABLE "public"."invoice_appointments" DROP CONSTRAINT "invoice_appointments_billed_shape_check";
--   ALTER TABLE "public"."invoice_appointments" DROP COLUMN "billed_minutes";
--   ALTER TABLE "public"."invoice_appointments" DROP COLUMN "billed_rate_cents";
--   ALTER TABLE "public"."invoice_appointments" DROP COLUMN "billed_amount_cents";
--   ALTER TABLE "public"."invoice_appointments" DROP COLUMN "is_archived";
--   ALTER TABLE "public"."invoice_appointments" DROP COLUMN "updated_at";
--   ALTER TABLE "public"."invoice_appointments" DROP COLUMN "created_at";
--
--   DROP TABLE "public"."client_job_pricing";
--
--   ALTER TABLE "public"."jobs" DROP CONSTRAINT "jobs_hourly_rate_cents_check";
--   ALTER TABLE "public"."jobs" RENAME COLUMN "hourly_rate_cents" TO "base_price_cents";
--
-- Renaming rather than dropping and re-adding is what makes that last line a true inverse: the
-- column keeps its data, its NOT NULL and its column number, so the down path needs no data
-- export and can be run on the live database.


-- 1. jobs --------------------------------------------------------------------------------------

-- RENAME COLUMN, never DROP + ADD. The values are the whole point: they are carried across
-- verbatim and only their unit changes. A drop-and-add would destroy every job's price on a
-- database this migration is meant to be safe on.
ALTER TABLE "public"."jobs" RENAME COLUMN "base_price_cents" TO "hourly_rate_cents";


-- The column was NOT NULL but unbounded. A negative rate has no meaning and would make every
-- derived amount negative, so pin it here rather than in three server actions.
ALTER TABLE "public"."jobs"
    ADD CONSTRAINT "jobs_hourly_rate_cents_check" CHECK (("hourly_rate_cents" >= 0));


COMMENT ON COLUMN "public"."jobs"."hourly_rate_cents" IS 'Rate charged per scheduled hour. 2026-09-18: renamed from base_price_cents, which was a flat per-visit price. Values were NOT recalculated -- a job that charged $120.00 per visit now charges $120.00 per hour. Deliberate business reinterpretation, approved by the owner.';


-- Stated explicitly because the obvious "fix" for the reinterpretation above is to divide the old
-- flat price by this column. That is exactly what must never happen: the estimate is a scheduling
-- hint, it is nullable, and it is not what anyone is billed for.
COMMENT ON COLUMN "public"."jobs"."estimated_duration_minutes" IS 'Scheduling hint only. Never used to compute money.';


-- 2. client_job_pricing ------------------------------------------------------------------------

-- Negotiated per-client, per-job rates. Effective-dated forward only: the newest row whose
-- effective_from is on or before the appointment's scheduled_date wins, which is why there is no
-- effective_to to keep consistent. One rate, no mode and no flat price -- the only flat amount in
-- the system is appointments.price_override_cents.
CREATE TABLE IF NOT EXISTS "public"."client_job_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "hourly_rate_cents" integer NOT NULL,
    "effective_from" "date" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false NOT NULL,
    CONSTRAINT "client_job_pricing_hourly_rate_cents_check" CHECK (("hourly_rate_cents" >= 0))
);


ALTER TABLE "public"."client_job_pricing" OWNER TO "postgres";


ALTER TABLE ONLY "public"."client_job_pricing"
    ADD CONSTRAINT "client_job_pricing_pkey" PRIMARY KEY ("id");


-- Two rules for the same client, job and day would make "the newest applicable rule" ambiguous.
-- The resolver relies on this constraint to skip tie-breaking entirely.
ALTER TABLE ONLY "public"."client_job_pricing"
    ADD CONSTRAINT "client_job_pricing_client_id_job_id_effective_from_key" UNIQUE ("client_id", "job_id", "effective_from");


ALTER TABLE ONLY "public"."client_job_pricing"
    ADD CONSTRAINT "client_job_pricing_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."client_job_pricing"
    ADD CONSTRAINT "client_job_pricing_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;


-- DESC on effective_from because every read is "the newest rule at or before this date" for a
-- known (client_id, job_id) pair.
CREATE INDEX "idx_client_job_pricing_client_id_job_id_effective_from" ON "public"."client_job_pricing" USING "btree" ("client_id", "job_id", "effective_from" DESC);


CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."client_job_pricing" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


ALTER TABLE "public"."client_job_pricing" ENABLE ROW LEVEL SECURITY;


-- The admin policy is the ONLY policy on this table, on purpose. Every column here is a price, and
-- what a client is billed is not what an employee is paid -- so there is no employee policy and no
-- anon policy to add, and adding one later would expose the whole table (RLS is row-level; it
-- cannot mask a column). The shape is copied from "Admin full access on jobs".
CREATE POLICY "Admin full access on client_job_pricing" ON "public"."client_job_pricing" TO "authenticated" USING ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text"));


-- Schema-wide convention: every table carries these three grants and RLS is the only gate. With no
-- employee and no anon policy above, neither role can read a row despite the grant.
GRANT ALL ON TABLE "public"."client_job_pricing" TO "anon";
GRANT ALL ON TABLE "public"."client_job_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."client_job_pricing" TO "service_role";


COMMENT ON TABLE "public"."client_job_pricing" IS 'Negotiated hourly rates for one client on one job, effective-dated forward. The newest non-archived row with effective_from <= the appointment date wins. Admin-only: this table has no employee policy by design.';


-- 3. invoice_appointments: housekeeping columns FIRST -------------------------------------------

-- This table has carried a BEFORE UPDATE set_updated_at() trigger since the schema snapshot but
-- never had an updated_at column, so every UPDATE on it raises
-- 'record "new" has no field "updated_at"'. It has gone unnoticed because the only write path
-- deletes and re-inserts links rather than updating them. These three columns must therefore land
-- before the backfill below, which is the first UPDATE this table has ever successfully run.
ALTER TABLE "public"."invoice_appointments"
    ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT "now"(),
    ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"(),
    ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;


-- 4. invoice_appointments: the frozen line ------------------------------------------------------

-- billed_amount_cents is nullable only for the length of this migration; the backfill fills it and
-- SET NOT NULL follows. rate and minutes stay nullable forever: a line with no minutes IS the flat
-- case (a manual override, or one of the legacy rows below), which is why there is no
-- billed_pricing_mode column to keep in sync with them.
ALTER TABLE "public"."invoice_appointments"
    ADD COLUMN IF NOT EXISTS "billed_amount_cents" integer,
    ADD COLUMN IF NOT EXISTS "billed_rate_cents" integer,
    ADD COLUMN IF NOT EXISTS "billed_minutes" integer;


-- Reproduces "price_override_cents ?? base_price_cents ?? 0" exactly, against the renamed column,
-- so every existing invoice line freezes at the amount the app was already charging. This is the
-- one place the reinterpretation must NOT reach: an hourly recomputation here would rewrite
-- history. The COALESCE's third branch is unreachable today (both columns are NOT NULL) and is
-- kept only so the expression reads as the one it replaces.
UPDATE "public"."invoice_appointments" "ia"
   SET "billed_amount_cents" = COALESCE("a"."price_override_cents", "j"."hourly_rate_cents", 0),
       "billed_rate_cents" = NULL,
       "billed_minutes" = NULL
  FROM "public"."appointments" "a"
  JOIN "public"."jobs" "j" ON ("j"."id" = "a"."job_id")
 WHERE "a"."id" = "ia"."appointment_id";


-- Should touch zero rows: both foreign keys cascade on delete, so a junction row without its
-- appointment cannot exist. It is here so that SET NOT NULL below cannot fail on a database whose
-- history we cannot see.
UPDATE "public"."invoice_appointments"
   SET "billed_amount_cents" = 0
 WHERE "billed_amount_cents" IS NULL;


ALTER TABLE "public"."invoice_appointments"
    ALTER COLUMN "billed_amount_cents" SET NOT NULL;


-- Both or neither. A rate without minutes cannot be multiplied out and minutes without a rate
-- cannot be priced, so either half alone is a line nobody can explain.
ALTER TABLE "public"."invoice_appointments"
    ADD CONSTRAINT "invoice_appointments_billed_shape_check" CHECK ((("billed_rate_cents" IS NULL) = ("billed_minutes" IS NULL)));


COMMENT ON COLUMN "public"."invoice_appointments"."billed_amount_cents" IS 'The charge for this line, frozen when the invoice was built. Source of truth for invoices.total_cents. Never recomputed from current rates.';


COMMENT ON COLUMN "public"."invoice_appointments"."billed_minutes" IS 'Scheduled minutes this line was priced over, with billed_rate_cents. Both NULL means the line is a flat amount -- a manual override, or a row backfilled from the pre-2026-09-18 flat price.';


-- 5. appointments -------------------------------------------------------------------------------

ALTER TABLE "public"."appointments"
    ADD COLUMN IF NOT EXISTS "billed_price_cents" integer;


COMMENT ON COLUMN "public"."appointments"."billed_price_cents" IS 'Denormalized copy of this appointment''s invoice_appointments.billed_amount_cents. NULL = not invoiced; use the live derived price. Display cache only -- never an input to price resolution (src/lib/pricing/resolve.ts) and never pre-fills the manual override field. Written only by createInvoice/updateInvoice.';


-- Must run after step 4: it copies what step 4 computed. Known side effect: appointments carries
-- its own BEFORE UPDATE set_updated_at() trigger, so every invoiced appointment's updated_at is
-- bumped to the migration time. Accepted -- no screen reads that column, and disabling the trigger
-- for a migration is a worse trade than a stale timestamp.
UPDATE "public"."appointments" "a"
   SET "billed_price_cents" = "ia"."billed_amount_cents"
  FROM "public"."invoice_appointments" "ia"
 WHERE "ia"."appointment_id" = "a"."id";
