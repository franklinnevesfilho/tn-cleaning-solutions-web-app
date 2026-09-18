-- Employee price lockdown.
--
-- Every price in this system is admin-only from here on: "jobs"."hourly_rate_cents",
-- "appointments"."price_override_cents" and "appointments"."billed_price_cents". Employees lose
-- the ability to read all three -- including on the appointments they are personally assigned to.
-- That is the owner's explicit decision of 2026-09-18 (ARCH-5 option b). What a client is billed
-- and what an employee is paid are two separate numbers; the pay side does not exist yet, so
-- nothing takes the place of the hidden number on an employee screen. Do not re-add a price, a
-- rate, or a placeholder to either view below.
--
-- RLS is row-level and cannot mask a column, so an employee holding any SELECT policy on "jobs" or
-- "appointments" can read the price columns off the base table no matter what a view selects. The
-- two employee policies are therefore dropped outright and every employee read of those tables is
-- routed through a column-restricted definer view. Re-adding either policy re-opens the leak.
--
-- This changes live behaviour twice over, and it deliberately breaks the three
-- "src/app/(internal)/solutions/(employee)/" screens until 01-03-T2 re-points them at the views:
-- they still embed "appointments!inner(...)" and the employee no longer has a policy there.
--
-- DOWN (verified: executed once against a reset database on 2026-09-18, then the database was
-- reset again). The order matters -- the client_locations policy depends on the function, so the
-- policy has to be replaced before the function can be dropped.
--
--   DROP POLICY "Employee select locations for assigned appointments" ON "public"."client_locations";
--   CREATE POLICY "Employee select locations for assigned appointments" ON "public"."client_locations" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "a"."location_id"
--      FROM "public"."appointments" "a"
--     WHERE (("a"."location_id" IS NOT NULL) AND ("a"."id" IN ( SELECT "public"."get_employee_appointment_ids"() AS "get_employee_appointment_ids"))))));
--
--   DROP FUNCTION "public"."get_employee_location_ids"();
--
--   DROP VIEW "public"."appointments_employee_view";
--   DROP VIEW "public"."jobs_employee_view";
--
--   CREATE POLICY "Employee select assigned appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING (((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text") OR ("id" IN ( SELECT "public"."get_employee_appointment_ids"() AS "get_employee_appointment_ids"))));
--   CREATE POLICY "Employee select jobs" ON "public"."jobs" FOR SELECT TO "authenticated" USING ((NOT "is_archived"));
--
-- The two re-created policies and the re-created client_locations policy are byte-for-byte the
-- definitions in 20260427000000_schema_snapshot.sql:574, :582 and :586-588, so the down path
-- restores the exact row sets that existed before this migration.


-- 1. jobs --------------------------------------------------------------------------------------

-- "hourly_rate_cents" lives on this table. Any SELECT policy here hands it to every employee, so
-- the policy goes rather than the column. Employees read jobs through "jobs_employee_view" below.
DROP POLICY IF EXISTS "Employee select jobs" ON "public"."jobs";


-- security_invoker is off on purpose: the caller now has no SELECT policy on "jobs", so an
-- invoker-rights view would return nothing at all. The row filter the dropped "Employee select
-- jobs" policy used to apply therefore has to live in the view body -- without it, definer rights
-- would turn this column restriction into a full-table read of every archived job as well.
--
-- The column list is explicit and must stay explicit. "SELECT *" would inherit "hourly_rate_cents"
-- and defeat the entire migration.
CREATE OR REPLACE VIEW "public"."jobs_employee_view" WITH ("security_invoker"='false') AS
 SELECT "id",
    "name",
    "description",
    "is_archived"
   FROM "public"."jobs"
  WHERE (NOT "is_archived");


ALTER VIEW "public"."jobs_employee_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."jobs_employee_view" IS 'Employee-safe view of jobs. Excludes the hourly_rate_cents column -- every price is admin-only. Runs with definer rights and applies the non-archived filter itself.';


-- A definer view with write privileges is an RLS bypass: it is auto-updatable, and the write would
-- run as the view owner against the base table. The blanket GRANT ALL that this schema's default
-- privileges hand out therefore has to come straight back off, leaving SELECT only. That exact bug
-- is what 20260917120000_secure_appointment_employees_view.sql:40-65 fixed for
-- employees_employee_view. anon gets nothing at all: no unauthenticated caller reads jobs.
REVOKE ALL ON TABLE "public"."jobs_employee_view" FROM "anon";

REVOKE ALL ON TABLE "public"."jobs_employee_view" FROM "authenticated";

REVOKE ALL ON TABLE "public"."jobs_employee_view" FROM "service_role";

GRANT SELECT ON TABLE "public"."jobs_employee_view" TO "authenticated";

GRANT SELECT ON TABLE "public"."jobs_employee_view" TO "service_role";


-- 2. appointments ------------------------------------------------------------------------------

-- "price_override_cents" and "billed_price_cents" both live on this table, so the same reasoning
-- as part 1 applies: the employee policy goes, and employees read appointments through
-- "appointments_employee_view". This one is a narrower loss than part 1 -- employees could read
-- the override on their own appointments until now -- and it is intended.
DROP POLICY IF EXISTS "Employee select assigned appointments" ON "public"."appointments";


-- The WHERE clause is the dropped policy's USING clause copied verbatim from
-- 20260427000000_schema_snapshot.sql:574, admin branch included, so the visible row set does not
-- move: an employee still sees exactly their own assignments and an admin still sees everything.
-- It has to live in the view body for the same reason as part 1.
--
-- Thirteen columns, named explicitly and permanently. "price_override_cents" and
-- "billed_price_cents" are the two deliberately absent ones and they are the whole point of the
-- view; a "SELECT *" here would have silently inherited "billed_price_cents" the moment
-- 20260918120000 added it. "job_id" and "location_id" are present on purpose even though no
-- current query names them: the employee screens need them if PostgREST declines to infer a
-- view-to-view embed, and having them here means that fallback costs no schema change.
CREATE OR REPLACE VIEW "public"."appointments_employee_view" WITH ("security_invoker"='false') AS
 SELECT "id",
    "client_id",
    "job_id",
    "recurrence_series_id",
    "scheduled_date",
    "scheduled_start_time",
    "scheduled_end_time",
    "status",
    "notes",
    "created_at",
    "updated_at",
    "is_archived",
    "location_id"
   FROM "public"."appointments"
  WHERE ((( SELECT "public"."get_user_role"() AS "get_user_role") = 'admin'::"text") OR ("id" IN ( SELECT "public"."get_employee_appointment_ids"() AS "get_employee_appointment_ids")));


ALTER VIEW "public"."appointments_employee_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."appointments_employee_view" IS 'Employee-safe view of appointments. Excludes the price_override_cents and billed_price_cents columns -- every price is admin-only, on assigned appointments included. Runs with definer rights and filters to the caller''s assigned appointments itself.';


REVOKE ALL ON TABLE "public"."appointments_employee_view" FROM "anon";

REVOKE ALL ON TABLE "public"."appointments_employee_view" FROM "authenticated";

REVOKE ALL ON TABLE "public"."appointments_employee_view" FROM "service_role";

GRANT SELECT ON TABLE "public"."appointments_employee_view" TO "authenticated";

GRANT SELECT ON TABLE "public"."appointments_employee_view" TO "service_role";


-- 3. client_locations, repaired ------------------------------------------------------------------

-- Postgres applies a table's RLS inside a policy expression that reads it, so
-- "Employee select locations for assigned appointments"
-- (20260427000000_schema_snapshot.sql:586-588) stopped working the moment part 2 dropped the
-- employee policy on "appointments": its subquery now sees zero rows for every employee, the
-- policy matches nothing, and employees silently lose the job-site address on their schedule. No
-- error, no failing query, just a missing line of text -- which is why the repair belongs in this
-- migration and not a later one.
--
-- The fix is the codebase's own convention for "a policy needs to read a table the caller cannot":
-- a STABLE SECURITY DEFINER function, mirroring get_employee_appointment_ids()
-- (20260427000000_schema_snapshot.sql:50-67). It resolves the employee from auth.uid() rather than
-- an argument, so it cannot be pointed at somebody else's locations.
CREATE OR REPLACE FUNCTION "public"."get_employee_location_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT a.location_id
    FROM public.appointments a
    WHERE a.location_id IS NOT NULL
      AND a.id IN (SELECT public.get_employee_appointment_ids());
$$;


ALTER FUNCTION "public"."get_employee_location_ids"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_employee_location_ids"() IS 'Location ids of the calling employee''s assigned appointments. Runs with definer rights because employees have no SELECT policy on appointments, which would otherwise make the client_locations policy that reads it match nothing.';


-- anon keeps EXECUTE, like every other function in this schema. The grant is safe because the
-- function resolves the employee from auth.uid() instead of an argument, so a caller without a
-- session matches no appointment and gets an empty set. Do not try to revoke it: CREATE FUNCTION
-- also grants EXECUTE to PUBLIC, so revoking from anon alone is a no-op, and revoking from PUBLIC
-- makes the denied-EXECUTE path crash the backend with SIGSEGV on the Supabase Postgres 17.6
-- image. See the same note at 20260917120000_secure_appointment_employees_view.sql:122-130.
GRANT ALL ON FUNCTION "public"."get_employee_location_ids"() TO "anon";

GRANT ALL ON FUNCTION "public"."get_employee_location_ids"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_employee_location_ids"() TO "service_role";


-- Same row set as before, reached without reading "appointments" as the caller. This is a repair,
-- not a widening: an employee sees the locations of the appointments they are assigned to, exactly
-- as they did at 20260427000000.
DROP POLICY IF EXISTS "Employee select locations for assigned appointments" ON "public"."client_locations";

CREATE POLICY "Employee select locations for assigned appointments" ON "public"."client_locations" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "public"."get_employee_location_ids"() AS "get_employee_location_ids")));
